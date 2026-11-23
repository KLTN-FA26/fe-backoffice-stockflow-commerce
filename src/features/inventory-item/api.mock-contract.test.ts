/**
 * Contract test: mock adapter nói đúng hợp đồng BE `InventoryItemController` cho `/inventory/items` —
 * `api.ts` (zod parse) chạy y hệt trên mock và BE thật. Không còn `PUT .../policy` (BE team plan 5-5).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetUomConversionMockStore } from "@/lib/api/mock-routes-uom-conversions";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { getInventoryItem, listInventoryItems, saveItemLogistics } from "./api";
import { logisticsToForm } from "./selectors";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetVariantMockStore();
  resetUomConversionMockStore();
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
  return getInventoryItem(items[0]?.id ?? "");
};

describe("GET /inventory/items", () => {
  it("phân trang 0-based; dòng chỉ có id, sku, đơn vị tính, mã vạch", async () => {
    const page = await listInventoryItems({ page: 0, size: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.hasNext).toBe(true);
    expect(page.page).toBe(0);
    for (const row of page.items) {
      expect(Object.keys(row).sort()).toEqual(
        ["barcode", "id", "sku", "unitOfMeasure"].filter((k) => k in row).sort(),
      );
    }
  });

  it("sắp theo SKU", async () => {
    const { items } = await all();
    const skus = items.map((i) => i.sku);
    expect(skus).toEqual([...skus].sort());
  });

  it("q khớp SKU (không phân biệt hoa thường) và mã vạch", async () => {
    const { items } = await all();
    const [first] = items;
    const withBarcode = items.find((i) => i.barcode);
    expect(first && withBarcode).toBeTruthy();
    const bySku = await listInventoryItems({
      page: 0,
      size: 50,
      q: ` ${first?.sku.toLowerCase()} `,
    });
    expect(bySku.items.map((i) => i.id)).toContain(first?.id);
    const byBarcode = await listInventoryItems({
      page: 0,
      size: 50,
      q: withBarcode?.barcode ?? "",
    });
    expect(byBarcode.items.map((i) => i.id)).toContain(withBarcode?.id);
  });
});

describe("GET /inventory/items/{id}", () => {
  it("trả id, sku, version, logistics — không còn policy / evaluation / storageClass", async () => {
    const { data } = await api.get<Record<string, unknown>>(
      `/inventory/items/${(await all()).items[0]?.id}`,
    );
    expect(Object.keys(data).sort()).toEqual(["id", "logistics", "sku", "version"]);
    const logistics = data.logistics as Record<string, unknown>;
    for (const gone of ["storageClass", "qcRequired", "requiresAdultSignature"]) {
      expect(logistics).not.toHaveProperty(gone);
    }
    const item = await firstItem();
    expect(item.version).toBe(0);
    expect(item.logistics.unitOfMeasure).toBeTruthy();
  });

  it("BE #396: logistics chỉ còn đơn vị tính, mã vạch, cờ xoay — không trả số đo", async () => {
    const item = await firstItem();
    const { data } = await api.get<{ logistics: Record<string, unknown> }>(
      `/inventory/items/${item.id}`,
    );
    expect(Object.keys(data.logistics).sort()).toEqual(["barcode", "rotatable", "unitOfMeasure"]);
  });

  it("id lạ → INVENTORY_ITEM_NOT_FOUND", async () => {
    expect((await apiError(getInventoryItem("khong-co"))).code).toBe("INVENTORY_ITEM_NOT_FOUND");
  });
});

describe("PUT /inventory/items/{id}/logistics", () => {
  it("hợp lệ → version + 1, logistics mới; rotatable false giữ nguyên khi đọc lại", async () => {
    const item = await firstItem();
    const saved = await saveItemLogistics({
      id: item.id,
      version: item.version,
      values: { ...logisticsToForm(item.logistics), barcode: "8939999999901", rotatable: false },
    });
    expect(saved).toMatchObject({
      version: 1,
      logistics: { barcode: "8939999999901", rotatable: false },
    });
    expect((await getInventoryItem(item.id)).logistics.rotatable).toBe(false);
  });

  it("client cũ còn gửi số đo (kể cả giá trị BE cũ từ chối) → bỏ qua như BE #396, không lỗi", async () => {
    const item = await firstItem();
    const { data } = await api.put<{ version: number; logistics: Record<string, unknown> }>(
      `/inventory/items/${item.id}/logistics`,
      {
        version: item.version,
        unitOfMeasure: item.logistics.unitOfMeasure,
        weightKg: -1,
        packageCount: 0,
        packSize: 0,
      },
    );
    expect(data.version).toBe(item.version + 1);
    for (const gone of ["weightKg", "packageCount", "packSize"]) {
      expect(data.logistics).not.toHaveProperty(gone);
    }
  });

  it("version cũ → OPTIMISTIC_LOCK", async () => {
    const item = await firstItem();
    const values = logisticsToForm(item.logistics);
    await saveItemLogistics({ id: item.id, version: item.version, values });
    const e = await apiError(saveItemLogistics({ id: item.id, version: item.version, values }));
    expect([e.status, e.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
  });

  it("mã vạch trùng item khác → CONFLICT", async () => {
    const { items } = await all();
    const taken = items.find((i) => i.barcode);
    const other = items.find((i) => i.id !== taken?.id);
    const target = await getInventoryItem(other?.id ?? "");
    const e = await apiError(
      saveItemLogistics({
        id: target.id,
        version: target.version,
        values: { ...logisticsToForm(target.logistics), barcode: taken?.barcode ?? "" },
      }),
    );
    expect([e.status, e.code]).toEqual([409, "CONFLICT"]);
  });

  it("đơn vị tính mới trùng một đơn vị đóng gói của SKU → UOM_CONVERSION_DUPLICATE", async () => {
    const item = await getInventoryItem("item-SKU-001-BLK-M");
    await api.post("/products/PRD-001/variants/SKU-001-BLK-M/uom-conversions", {
      unitOfMeasure: "CARTON",
      factor: 50,
    });
    const e = await apiError(
      saveItemLogistics({
        id: item.id,
        version: item.version,
        values: { ...logisticsToForm(item.logistics), unitOfMeasure: "CARTON" },
      }),
    );
    expect([e.status, e.code]).toEqual([409, "UOM_CONVERSION_DUPLICATE"]);
  });

  it("id lạ → INVENTORY_ITEM_NOT_FOUND", async () => {
    const item = await firstItem();
    const e = await apiError(
      saveItemLogistics({ id: "khong-co", version: 0, values: logisticsToForm(item.logistics) }),
    );
    expect(e.code).toBe("INVENTORY_ITEM_NOT_FOUND");
  });
});
