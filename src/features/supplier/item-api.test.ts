import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  createSupplierItem,
  deleteSupplierItem,
  listSupplierItems,
  toSaveSupplierItemRequest,
  updateSupplierItem,
} from "./item-api";

import type { SupplierItem, SupplierItemFormValues } from "./types";

afterEach(() => vi.restoreAllMocks());

const values: SupplierItemFormValues = {
  sku: "TEE-001",
  supplierSkuCode: "",
  price: "12.5",
  moq: "10",
  packSize: "2",
  leadTimeDays: "",
  preferred: false,
};

const wire = {
  supplierItemId: "SI-1",
  supplierId: "SUP-001",
  inventoryItemId: "INV-1",
  sku: "TEE-001",
  supplierSkuCode: null,
  price: "12.50",
  currency: "USD",
  moq: 10,
  packSize: 2,
  leadTimeDays: null,
  effectiveLeadTimeDays: 7,
  preferred: false,
  version: 3,
  createdAt: "2026-10-01T00:00:00Z",
  lastModifiedAt: "2026-10-01T00:00:00Z",
};
const item: SupplierItem = { ...wire, price: 12.5 };

describe("supplier item API — hợp đồng BE SupplierItemController", () => {
  it("giá dấu phẩy thập phân → gửi số đúng (12,5 → 12.5)", () => {
    expect(toSaveSupplierItemRequest({ ...values, price: "12,5" }).price).toBe(12.5);
  });

  it("toSaveSupplierItemRequest không gửi currency, rỗng → null", () => {
    const body = toSaveSupplierItemRequest(values);
    expect(body).toEqual({
      sku: "TEE-001",
      supplierSkuCode: null,
      price: 12.5,
      moq: 10,
      packSize: 2,
      leadTimeDays: null,
      preferred: false,
    });
    expect(body).not.toHaveProperty("currency");
    expect(body).not.toHaveProperty("version");
    expect(toSaveSupplierItemRequest({ ...values, leadTimeDays: "5" }, 1)).toMatchObject({
      leadTimeDays: 5,
      version: 1,
    });
  });

  it("PUT luôn có preferred và version", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: wire });
    await updateSupplierItem({
      supplierId: "SUP-001",
      item,
      values: { ...values, preferred: true },
    });
    expect(put.mock.calls[0]?.[0]).toBe("/suppliers/SUP-001/items/SI-1");
    expect(put.mock.calls[0]?.[1]).toMatchObject({ preferred: true, version: 3 });

    await updateSupplierItem({ supplierId: "SUP-001", item, values });
    expect(put.mock.calls[1]?.[1]).toMatchObject({ preferred: false, version: 3 });
    expect(put.mock.calls[1]?.[1]).toHaveProperty("preferred", false);
  });

  it("POST tạo mới không kèm version; DELETE gửi ?version=", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: wire });
    const created = await createSupplierItem({ supplierId: "SUP-001", values });
    expect(post.mock.calls[0]?.[0]).toBe("/suppliers/SUP-001/items");
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("version");
    expect(created.price).toBe(12.5);

    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    await deleteSupplierItem({ supplierId: "SUP-001", item });
    expect(del.mock.calls[0]?.[0]).toBe("/suppliers/SUP-001/items/SI-1");
    expect((del.mock.calls[0]?.[1]?.params as URLSearchParams).get("version")).toBe("3");
  });

  it("list gửi page/size/sort và parse trang", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [wire],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
    const page = await listSupplierItems("SUP-001", {
      page: 1,
      size: 20,
      sort: "currentPrice,asc",
    });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(params.get("page")).toBe("1");
    expect(params.get("sort")).toBe("currentPrice,asc");
    expect(page.items[0]?.price).toBe(12.5);
  });
});
