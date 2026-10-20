/**
 * Contract test: mock adapter nói đúng hợp đồng BE PR #119 cho `/inventory/items` — `api.ts`
 * (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryPolicyStore } from "@/lib/api/mock-routes-inventory-policy";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  getInventoryItem,
  listInventoryItems,
  saveItemLogistics,
  saveItemPolicy,
  toLogisticsRequest,
  toPolicyRequest,
} from "./api";
import { inventoryItemFieldErrors } from "./errors";
import { logisticsToForm, policyToForm } from "./selectors";

import type { PolicyFormValues } from "./types";

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
const policyValues = (over: Partial<PolicyFormValues> = {}): PolicyFormValues => ({
  reorderPoint: "20",
  safetyStock: "5",
  maxQty: "100",
  maxShelfLifeDays: "",
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  ...over,
});

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

  it("lọc storageClass và policyConfigured đúng tập", async () => {
    const { items } = await all();
    const normal = await listInventoryItems({ page: 0, size: 200, storageClass: "NORMAL" });
    expect(normal.items.length).toBe(items.filter((i) => i.storageClass === "NORMAL").length);
    expect(normal.items.every((i) => i.storageClass === "NORMAL")).toBe(true);

    const none = await listInventoryItems({ page: 0, size: 200, policyConfigured: true });
    expect(none.items).toHaveLength(0);
    const item = await firstItem();
    await saveItemPolicy({ id: item.id, version: item.version, values: policyValues() });
    const configured = await listInventoryItems({ page: 0, size: 200, policyConfigured: true });
    expect(configured.items.map((i) => i.id)).toEqual([item.id]);
    const rest = await listInventoryItems({ page: 0, size: 200, policyConfigured: false });
    expect(rest.items).toHaveLength(items.length - 1);
  });

  it("lưu chính sách rỗng (cả ba ngưỡng null) vẫn là đã cấu hình — như BE policy_configured", async () => {
    const item = await firstItem();
    await saveItemPolicy({
      id: item.id,
      version: item.version,
      values: policyValues({ reorderPoint: "", safetyStock: "", maxQty: "" }),
    });
    const configured = await listInventoryItems({ page: 0, size: 200, policyConfigured: true });
    expect(configured.items.map((i) => i.id)).toEqual([item.id]);
  });
});

describe("GET /inventory/items/{id}", () => {
  it("trả version, logistics, policy, evaluation", async () => {
    const item = await firstItem();
    expect(item.version).toBe(0);
    expect(item.logistics.unitOfMeasure).toBeTruthy();
    expect(item.policy.removalStrategy).toBe("FIFO");
    // BE bỏ trường null khỏi JSON (non_null) — ngưỡng chưa đặt thì không có kết quả đánh giá
    expect(item.evaluation.reorderRequired).toBeUndefined();
  });

  it("id lạ → INVENTORY_ITEM_NOT_FOUND", async () => {
    expect((await apiError(getInventoryItem("khong-co"))).code).toBe("INVENTORY_ITEM_NOT_FOUND");
  });
});

describe("PUT /inventory/items/{id}/policy", () => {
  it("hợp lệ → version + 1, policy và evaluation mới", async () => {
    const item = await firstItem();
    const saved = await saveItemPolicy({
      id: item.id,
      version: item.version,
      values: policyValues({ reorderPoint: "1000", safetyStock: "5", maxQty: "2000" }),
    });
    expect(saved.version).toBe(item.version + 1);
    expect(saved.policy.reorderPoint).toBe(1000);
    // ASSUMPTION mock: tồn khả dụng cố định < 1000 nên phải đặt lại
    expect(saved.evaluation.reorderRequired).toBe(true);
    expect(saved.evaluation.reorderPoint).toBe(1000);
  });

  it("version cũ → OPTIMISTIC_LOCK", async () => {
    const item = await firstItem();
    await saveItemPolicy({ id: item.id, version: item.version, values: policyValues() });
    const e = await apiError(
      saveItemPolicy({ id: item.id, version: item.version, values: policyValues() }),
    );
    expect(e.code).toBe("OPTIMISTIC_LOCK");
  });

  it("maxQty < reorderPoint → INVENTORY_POLICY_INVALID kèm lỗi trên maxQty", async () => {
    const item = await firstItem();
    const e = await apiError(
      saveItemPolicy({
        id: item.id,
        version: item.version,
        values: policyValues({ reorderPoint: "50", safetyStock: "5", maxQty: "10" }),
      }),
    );
    expect(e.code).toBe("INVENTORY_POLICY_INVALID");
    expect(inventoryItemFieldErrors(e).maxQty).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.INVENTORY_MAX_QTY_BELOW_THRESHOLD,
    );
  });

  it("tồn an toàn > điểm đặt lại → INVENTORY_POLICY_INVALID", async () => {
    const item = await firstItem();
    const e = await apiError(
      saveItemPolicy({
        id: item.id,
        version: item.version,
        values: policyValues({ reorderPoint: "5", safetyStock: "9", maxQty: "" }),
      }),
    );
    expect(e.code).toBe("INVENTORY_POLICY_INVALID");
  });

  it("theo dõi hạn dùng không kèm LOT + FEFO → INVENTORY_POLICY_INVALID", async () => {
    const item = await firstItem();
    const e = await apiError(
      saveItemPolicy({
        id: item.id,
        version: item.version,
        values: policyValues({ expiryTracked: true }),
      }),
    );
    expect(e.code).toBe("INVENTORY_POLICY_INVALID");
  });

  it("LOT + FEFO + hạn dùng hợp lệ → lưu được", async () => {
    const item = await firstItem();
    const saved = await saveItemPolicy({
      id: item.id,
      version: item.version,
      values: policyValues({
        expiryTracked: true,
        trackingMode: "LOT",
        removalStrategy: "FEFO",
        maxShelfLifeDays: "365",
      }),
    });
    expect(saved.policy.maxShelfLifeDays).toBe(365);
    expect(policyToForm(saved.policy).expiryTracked).toBe(true);
  });

  it("id lạ → INVENTORY_ITEM_NOT_FOUND", async () => {
    const e = await apiError(
      saveItemPolicy({ id: "khong-co", version: 0, values: policyValues() }),
    );
    expect(e.code).toBe("INVENTORY_ITEM_NOT_FOUND");
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
          storageClass: logistics.storageClass,
          requiresAdultSignature: false,
          shippingRestrictionNote: "",
          qcRequired: false,
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

describe("toPolicyRequest", () => {
  it("không theo dõi hạn dùng → maxShelfLifeDays null dù ô còn giá trị", () => {
    expect(
      toPolicyRequest(policyValues({ expiryTracked: false, maxShelfLifeDays: "30" }), 3)
        .maxShelfLifeDays,
    ).toBeNull();
  });

  it("ô trống → null, có số → number, mang version", () => {
    const req = toPolicyRequest(policyValues({ maxQty: "" }), 3);
    expect(req).toMatchObject({ version: 3, reorderPoint: 20, safetyStock: 5, maxQty: null });
  });
});
