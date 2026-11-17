/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #119 cho `/inventory/items` — `api.ts`
 * (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryPolicyStore } from "@/lib/api/mock-routes-inventory-policy";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { getInventoryItem, listInventoryItems, saveItemLogistics, toLogisticsRequest } from "./api";
import { logisticsToForm } from "./selectors";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetVariantMockStore();
  resetInventoryPolicyStore();
});
afterAll(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

const all = () => listInventoryItems({ page: 0, size: 200 });
const firstItem = async () => {
  const { items } = await all();
  return getInventoryItem(items[0].id);
};

describe("GET /inventory/items", () => {
  it("phân trang 0-based", async () => {
    const page = await listInventoryItems({ page: 0, size: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.hasNext).toBe(true);
    expect(page.page).toBe(0);
  });

  it("sắp theo SKU", async () => {
    const { items } = await all();
    const skus = items.map((i) => i.sku);
    expect(skus).toEqual([...skus].sort());
  });

  it("q khớp SKU (không phân biệt hoa thường) và mã vạch", async () => {
    const { items } = await all();
    const withBarcode = items.find((i) => i.barcode);
    expect(withBarcode).toBeDefined();
    const bySku = await listInventoryItems({
      page: 0,
      size: 50,
      q: ` ${items[0].sku.toLowerCase()} `,
    });
    expect(bySku.items.map((i) => i.id)).toContain(items[0].id);
    const byBarcode = await listInventoryItems({
      page: 0,
      size: 50,
      q: withBarcode?.barcode ?? "",
    });
    expect(byBarcode.items.map((i) => i.id)).toContain(withBarcode?.id);
  });
});

describe("GET /inventory/items/{id}", () => {
  it("trả version và logistics", async () => {
    const item = await firstItem();
    expect(item.version).toBe(0);
    expect(item.logistics.unitOfMeasure).toBeTruthy();
  });

  it("id lạ → INVENTORY_ITEM_NOT_FOUND", async () => {
    expect((await apiError(getInventoryItem("khong-co"))).code).toBe("INVENTORY_ITEM_NOT_FOUND");
  });
});

describe("PUT /inventory/items/{id}/logistics", () => {
  it("mã vạch trùng item khác → CONFLICT", async () => {
    const { items } = await all();
    const taken = items.find((i) => i.barcode);
    const other = items.find((i) => i.id !== taken?.id);
    expect(taken && other).toBeTruthy();
    const target = await getInventoryItem(other?.id ?? "");
    const { logistics } = target;
    const e = await apiError(
      saveItemLogistics({
        id: target.id,
        version: target.version,
        values: {
          unitOfMeasure: logistics.unitOfMeasure,
          barcode: taken?.barcode ?? "",
          weightKg: "",
          lengthCm: "",
          widthCm: "",
          heightCm: "",
          packageWeightKg: "",
          packageLengthCm: "",
          packageWidthCm: "",
          packageHeightCm: "",
          packageCount: "1",
          packSize: "1",
          rotatable: true,
        },
      }),
    );
    expect(e.code).toBe("CONFLICT");
  });
});

describe("PUT /inventory/items/{id}/logistics — rotatable (BE #121)", () => {
  it("mặc định true; lưu false → GET lại vẫn false; toLogisticsRequest luôn gửi trường", async () => {
    const item = await firstItem();
    expect(item.logistics.rotatable).toBe(true);
    const values = { ...logisticsToForm(item.logistics), rotatable: false };
    expect(toLogisticsRequest(values, item.version).rotatable).toBe(false);

    await saveItemLogistics({ id: item.id, version: item.version, values });

    expect((await getInventoryItem(item.id)).logistics.rotatable).toBe(false);
  });
});
