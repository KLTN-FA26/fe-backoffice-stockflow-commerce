import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { fetchSupplierCatalog, supplierItemKeys, supplierItemSchema } from "./supplier-items";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn() } }));

const getMock = vi.mocked(api.get);

function row(sku: string, overrides: Record<string, unknown> = {}) {
  return {
    supplierItemId: `si-${sku}`,
    supplierId: "S1",
    inventoryItemId: `ii-${sku}`,
    sku,
    supplierSkuCode: null,
    price: "5000000.00",
    currency: "VND",
    moq: 10,
    packSize: 5,
    leadTimeDays: null,
    effectiveLeadTimeDays: 7,
    preferred: false,
    version: 0,
    createdAt: "2026-10-01T00:00:00Z",
    lastModifiedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function page(items: unknown[], totalElements = items.length) {
  return {
    items,
    page: 0,
    size: 200,
    totalElements,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}

describe("supplier-items", () => {
  beforeEach(() => getMock.mockReset());

  it("parse SupplierItemResponse: price dạng chuỗi → số, leadTimeDays null", () => {
    const parsed = supplierItemSchema.parse(row("SKU-A"));
    expect(parsed.price).toBe(5000000);
    expect(parsed.leadTimeDays).toBeNull();
  });

  it("BE bỏ field null (Jackson non_null) → vẫn parse, chuẩn hoá về null", () => {
    const { supplierSkuCode: _code, leadTimeDays: _lead, ...omitted } = row("SKU-A");
    const parsed = supplierItemSchema.parse(omitted);
    expect(parsed.supplierSkuCode).toBeNull();
    expect(parsed.leadTimeDays).toBeNull();
  });

  it("dòng chưa sửa lần nào (last_modified_at NULL, BE bỏ khỏi JSON) → vẫn parse", () => {
    const { lastModifiedAt: _modified, ...neverEdited } = row("SKU-SEED");
    expect(supplierItemSchema.parse(neverEdited).lastModifiedAt).toBeNull();
  });

  it("fetchSupplierCatalog gọi đúng path, size 200, sắp theo SKU", async () => {
    getMock.mockResolvedValue({ data: page([row("SKU-B"), row("SKU-A")]) });
    const catalog = await fetchSupplierCatalog("S1");
    const [path, config] = getMock.mock.calls[0] ?? [];
    expect(path).toBe("/suppliers/S1/items");
    expect(new URLSearchParams(config?.params as URLSearchParams).get("size")).toBe("200");
    expect(catalog.items.map((i) => i.sku)).toEqual(["SKU-A", "SKU-B"]);
    expect(catalog.currency).toBe("VND");
  });

  it("truncated khi totalElements > số dòng nhận", async () => {
    getMock.mockResolvedValue({ data: page([row("SKU-A")], 201) });
    expect((await fetchSupplierCatalog("S1")).truncated).toBe(true);

    getMock.mockResolvedValue({ data: page([]) });
    const empty = await fetchSupplierCatalog("S1");
    expect(empty.currency).toBeNull();
    expect(empty.truncated).toBe(false);
  });

  it("key list/catalog nằm dưới all", () => {
    expect(supplierItemKeys.catalog("S1").slice(0, 2)).toEqual(supplierItemKeys.all);
    expect(supplierItemKeys.list("S1", { page: 0 }).slice(0, 2)).toEqual(supplierItemKeys.all);
    expect(supplierItemKeys.lists("S1").slice(0, 2)).toEqual(supplierItemKeys.all);
  });
});
