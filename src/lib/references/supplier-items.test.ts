import { describe, expect, it } from "vitest";

import { supplierItemKeys, supplierItemSchema } from "./supplier-items";

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

describe("supplier-items", () => {
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

  it("key list/catalog nằm dưới all", () => {
    expect(supplierItemKeys.catalog("S1").slice(0, 2)).toEqual(supplierItemKeys.all);
    expect(supplierItemKeys.list("S1", { page: 0 }).slice(0, 2)).toEqual(supplierItemKeys.all);
    expect(supplierItemKeys.lists("S1").slice(0, 2)).toEqual(supplierItemKeys.all);
  });
});
