/**
 * BE `CustomerSkuResponse` gọi id của SKU riêng là `id` (đổi từ `variantId`, V20270105000100). Màn báo giá và thẻ SKU
 * của khách đọc nó thành `variantId`; trước khi sửa, cả danh sách không parse được và form báo giá mất hết dòng.
 */
import { describe, expect, it } from "vitest";

import { customerSkuListDtoSchema } from "@/features/quote/schemas";

import { customerSkuIdAsVariantId, customerSkuSchema } from "../customer-skus";

const BE_ROW = {
  id: "90b49fe8-3d63-57f8-096e-0c7b820080d6",
  productId: "32c25816-da24-fb3a-d680-c66c93570274",
  sku: "LY-GIAY-DEMO-12OZ-XANH",
  name: "Ly giấy 2 lớp in logo - 12 oz - logo xanh",
  ownerCustomerId: "0b7d3c1e-0000-4000-8000-0000000000c1",
  designSnapshotId: null,
  sourceVariantId: "6b246983-0f50-b205-73c2-6811f46f10cb",
  sourceSku: "LY-GIAY-DEMO-12OZ",
  status: "ACTIVE",
  unitsPerCarton: 1000,
  taxClass: "STANDARD",
  taxRate: 8,
  ownerCustomerName: "Khách hàng demo",
  ownerCustomerCode: "0312345678",
};

describe("SKU riêng của khách — đọc đúng hình BE (id tên `id`)", () => {
  it("thẻ SKU ở trang khách đọc `id` của BE thành `variantId`", () => {
    const parsed = customerSkuSchema.parse(BE_ROW);
    expect(parsed.variantId).toBe(BE_ROW.id);
    expect(parsed.sku).toBe(BE_ROW.sku);
  });

  it("form báo giá đọc cả danh sách của BE, không lỗi", () => {
    const parsed = customerSkuListDtoSchema.parse([BE_ROW]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.variantId).toBe(BE_ROW.id);
    expect(parsed[0]?.unitsPerCarton).toBe(1000);
    expect(parsed[0]?.taxRate).toBe(8);
  });

  it("thân đã có `variantId` (BE cũ, dữ liệu test) được giữ nguyên", () => {
    const { id, ...rest } = BE_ROW;
    const parsed = customerSkuSchema.parse({ ...rest, variantId: id });
    expect(parsed.variantId).toBe(id);
  });

  it("giá trị không phải object đi qua nguyên vẹn để Zod báo lỗi như thường", () => {
    expect(customerSkuIdAsVariantId(null)).toBeNull();
    expect(customerSkuIdAsVariantId("x")).toBe("x");
  });
});
