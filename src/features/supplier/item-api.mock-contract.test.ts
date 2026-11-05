/**
 * Contract test: mock adapter nói đúng hợp đồng BE `SupplierItemController` để `item-api.ts`
 * (zod parse + request mapper) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetPoMockStore } from "@/lib/api/mock-routes-purchase-orders-store";
import { resetSupplierItemMockStore } from "@/lib/api/mock-routes-supplier-items-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";

import {
  createSupplierItem,
  deleteSupplierItem,
  listSupplierItems,
  updateSupplierItem,
} from "./item-api";
import { supplierItemFieldErrors } from "./item-errors";

import type { SupplierItemFormValues } from "./types";

const SUPPLIER = "SUP-001";
const values: SupplierItemFormValues = {
  sku: "NEW-SKU-1",
  supplierSkuCode: "",
  price: "1000",
  moq: "10",
  packSize: "5",
  leadTimeDays: "",
  preferred: false,
};

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetSupplierMockStore();
  resetPoMockStore();
  resetSupplierItemMockStore();
});
afterAll(() => vi.restoreAllMocks());

// Mỗi request mock trễ ~350ms, mỗi test 4–5 request → vượt 5s mặc định khi chạy song song.
// Timeout phải truyền vào `it` — `vi.setConfig` trong `beforeAll` không áp cho test đã thu thập.
const SLOW = { timeout: 30_000 };

describe("supplier item API ↔ mock adapter", () => {
  it("tạo → sửa (version tăng) → xoá, đi trọn qua mock adapter", SLOW, async () => {
    const created = await createSupplierItem({ supplierId: SUPPLIER, values });
    expect(created).toMatchObject({ sku: "NEW-SKU-1", version: 0, preferred: false });

    const updated = await updateSupplierItem({
      supplierId: SUPPLIER,
      item: created,
      values: { ...values, price: "1200", preferred: true },
    });
    expect(updated.version).toBe(created.version + 1);
    expect(updated).toMatchObject({ price: 1200, preferred: true });

    const page = await listSupplierItems(SUPPLIER, { page: 0, size: 200 });
    expect(page.items.map((i) => i.sku)).toContain("NEW-SKU-1");

    await deleteSupplierItem({ supplierId: SUPPLIER, item: updated });
    const after = await listSupplierItems(SUPPLIER, { page: 0, size: 200 });
    expect(after.items.map((i) => i.sku)).not.toContain("NEW-SKU-1");
  });

  it("sửa bằng version cũ → 409 OPTIMISTIC_LOCK; trùng SKU → lỗi ở ô sku", SLOW, async () => {
    const created = await createSupplierItem({ supplierId: SUPPLIER, values });
    await updateSupplierItem({ supplierId: SUPPLIER, item: created, values });
    const stale = await updateSupplierItem({ supplierId: SUPPLIER, item: created, values }).catch(
      (e: unknown) => e,
    );
    expect(stale).toBeInstanceOf(ApiError);
    expect(stale instanceof ApiError && stale.code).toBe("OPTIMISTIC_LOCK");

    const dup = await createSupplierItem({ supplierId: SUPPLIER, values }).catch((e: unknown) => e);
    expect(dup).toBeInstanceOf(ApiError);
    if (dup instanceof ApiError) {
      expect(Object.keys(supplierItemFieldErrors(dup))).toEqual(["sku"]);
    }
  });
});
