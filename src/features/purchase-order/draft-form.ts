/**
 * Purchase Order — PO nháp đã lưu → giá trị form sửa nháp (BE SCRUM-462 `PUT /purchase-orders/{id}`).
 * Thuần, không I/O; tính MỘT lần khi mở form.
 */

import { termsOf } from "./line-terms";

import type { SupplierCatalog } from "@/lib/references/supplier-items";
import type { PoCreateFormValues } from "./create-form-schema";
import type { PoLineTerms } from "./line-terms";
import type { PurchaseOrder } from "./types";

/**
 * Mỗi dòng giữ `lineId` + đơn giá đã lưu (giá đã thương lượng, issue #30 §2) và gắn lại điều khoản
 * danh mục hiện tại theo SKU. BR-01 (docs 02 §6): SKU không còn trong danh mục ⇒ `terms` null —
 * form báo lỗi ở dòng đó (BE kiểm lại mọi dòng theo danh mục hiện tại).
 */
export function poToFormValues(
  po: PurchaseOrder,
  catalog: SupplierCatalog | undefined,
  /** Điều khoản theo SKU cho dòng nằm ngoài trang danh mục đã tải (danh mục > 200 dòng). */
  extraTerms: ReadonlyMap<string, PoLineTerms> = new Map(),
): PoCreateFormValues {
  const bySku = new Map((catalog?.items ?? []).map((item) => [item.sku, item]));
  return {
    supplierId: po.supplierId,
    warehouseId: po.warehouseId,
    // BR-07 (docs 02 §6): tiền tệ cố định theo PO — giữ đúng mã, màn sửa chỉ hiển thị.
    currency: po.currency,
    expectedDate: po.expectedDate,
    note: po.note ?? "",
    lines: po.lines.map((line) => {
      const item = bySku.get(line.skuId);
      return {
        lineId: line.lineId,
        skuId: line.skuId,
        description: line.description ?? "",
        orderedQty: String(line.orderedQty),
        unitPrice: String(line.unitPrice),
        taxRate: String(line.taxRate),
        terms: item ? termsOf(item) : (extraTerms.get(line.skuId) ?? null),
      };
    }),
  };
}
