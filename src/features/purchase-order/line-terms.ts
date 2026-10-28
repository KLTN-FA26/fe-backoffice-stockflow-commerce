/**
 * Purchase Order — điều khoản dòng PO lấy từ danh mục hàng của NCC (BE `SupplierItem`).
 * Form giữ bản chụp lúc chọn SKU (`terms`) để zod kiểm MOQ / bội số / giá ngay trên dòng.
 */

import { UI_LABELS } from "@/constants";

import type { SupplierItemRef } from "@/lib/references/supplier-items";

export type PoLineTerms = {
  moq: number;
  packSize: number;
  price: number;
  currency: string;
  effectiveLeadTimeDays: number;
};

export type OrderQuantityIssue = "BELOW_MOQ" | "NOT_PACK_MULTIPLE";

/** Từ dòng danh mục (`SupplierItemRef`) hoặc tra cứu theo SKU (`SkuSupplierRef`) — cùng các field. */
export function termsOf(item: Pick<SupplierItemRef, keyof PoLineTerms>): PoLineTerms {
  return {
    moq: item.moq,
    packSize: item.packSize,
    price: item.price,
    currency: item.currency,
    effectiveLeadTimeDays: item.effectiveLeadTimeDays,
  };
}

/**
 * BR-01 (docs 02 §6) + docs 02 §4 bước 5 (MOQ, bội số đóng gói) + BE BR-PO-001:
 * chép đúng `SupplierItem#orderQuantityViolations` — dưới MOQ và/hoặc không chia hết quy cách.
 */
export function orderQuantityIssues(
  quantity: number,
  terms: Pick<PoLineTerms, "moq" | "packSize">,
): OrderQuantityIssue[] {
  const issues: OrderQuantityIssue[] = [];
  if (quantity < terms.moq) issues.push("BELOW_MOQ");
  if (quantity % terms.packSize !== 0) issues.push("NOT_PACK_MULTIPLE");
  return issues;
}

/**
 * SL nhỏ nhất thoả cả MOQ lẫn bội số quy cách (cùng luật `orderQuantityIssues`, BE BR-PO-001) —
 * SL điền sẵn khi thêm dòng từ danh mục, để dòng mới không báo lỗi ngay.
 */
export function minimumOrderQuantity(terms: Pick<PoLineTerms, "moq" | "packSize">): number {
  return Math.ceil(terms.moq / terms.packSize) * terms.packSize;
}

export function poQuantityTermsMessage(terms: Pick<PoLineTerms, "moq" | "packSize">): string {
  return UI_LABELS.purchaseOrder.validation.quantityTerms
    .replace("{moq}", String(terms.moq))
    .replace("{pack}", String(terms.packSize));
}
