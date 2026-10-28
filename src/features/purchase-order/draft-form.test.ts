import { describe, expect, it } from "vitest";

import { supplierItemSchema } from "@/lib/references/supplier-items";

import { CATALOG } from "./__fixtures__/create";
import { bePo, bePoLine } from "./__fixtures__/render";
import { poToFormValues } from "./draft-form";
import { mapBePoToFe } from "./mappers";
import { bePurchaseOrderSchema } from "./schemas";

import type { SupplierCatalog } from "@/lib/references/supplier-items";

const toPo = (overrides: Record<string, unknown> = {}) =>
  mapBePoToFe(bePurchaseOrderSchema.parse(bePo(overrides)));

const catalog: SupplierCatalog = {
  items: CATALOG.map((item) => supplierItemSchema.parse(item)),
  currency: "VND",
  truncated: false,
};

describe("poToFormValues (sửa PO nháp, #30)", () => {
  it("poToFormValues giữ lineId, giá cũ và gắn terms theo SKU", () => {
    const po = toPo({ note: "Giao giờ hành chính" });
    const values = poToFormValues(po, catalog);
    expect(values).toMatchObject({
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      currency: "VND",
      expectedDate: "2099-01-01",
      note: "Giao giờ hành chính",
    });
    expect(values.lines).toEqual([
      {
        lineId: "33333333-3333-4333-8333-333333333333",
        skuId: "SOFA-3S-GREY",
        description: "Sofa 3 chỗ",
        orderedQty: "10",
        // Giá đã thương lượng của dòng (100 000), không phải giá danh mục (1 500 000).
        unitPrice: "100000",
        taxRate: "0",
        terms: { moq: 1, packSize: 1, price: 1500000, currency: "VND", effectiveLeadTimeDays: 7 },
      },
    ]);
  });

  it("SKU không còn trong danh mục → terms null", () => {
    const po = toPo({ lines: [bePoLine({ sku: "CHAIR-OLD", description: null })] });
    const [line] = poToFormValues(po, catalog).lines;
    expect(line).toMatchObject({ skuId: "CHAIR-OLD", description: "", terms: null });
    expect(poToFormValues(po, undefined).lines[0]?.terms).toBeNull();
  });

  it("danh mục > 200 dòng: SKU nằm ngoài trang đầu → lấy điều khoản từ tra cứu theo SKU", () => {
    const po = toPo({ lines: [bePoLine({ sku: "LAMP-XL" })] });
    const extra = new Map([
      ["LAMP-XL", { moq: 4, packSize: 2, price: 90000, currency: "VND", effectiveLeadTimeDays: 5 }],
    ]);
    const [line] = poToFormValues(po, { ...catalog, truncated: true }, extra).lines;
    expect(line?.terms).toEqual({
      moq: 4,
      packSize: 2,
      price: 90000,
      currency: "VND",
      effectiveLeadTimeDays: 5,
    });
  });

  it("PO tiền tệ ngoài danh sách chọn của màn tạo (EUR) → form giữ đúng EUR, không rơi về VND", () => {
    expect(poToFormValues(toPo({ currency: "EUR" }), catalog).currency).toBe("EUR");
  });

  it("PO chưa có ngày giao → ô ngày giao trống (bắt buộc nhập khi lưu)", () => {
    expect(poToFormValues(toPo({ expectedAt: null }), catalog).expectedDate).toBe("");
  });
});
