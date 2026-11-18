/**
 * Selector thuần cho báo giá theo thùng. Giá thật do BE tính — các hàm ở đây chỉ để XEM TRƯỚC trên
 * form và luôn ghi rõ "tạm tính"; số chốt luôn đọc lại từ `proposed` / `accepted` của BE.
 */

import type { Quote, QuoteTier, QuoteTotals } from "./types";

/**
 * Bậc giá theo số thùng: bậc có `minQuantity` lớn nhất ≤ số thùng. Dưới bậc thấp nhất (= MOQ) → `null`
 * (BE trả QUOTE_BELOW_MOQ, 14 BR-08).
 */
export function tierPrice(tiers: readonly QuoteTier[], cartons: number): number | null {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const first = sorted[0];
  if (!first || !Number.isFinite(cartons) || cartons < first.minQuantity) return null;
  return sorted.filter((tier) => tier.minQuantity <= cartons).at(-1)?.unitPrice ?? null;
}

/** MOQ = số thùng của bậc thấp nhất. */
export function moqOf(tiers: readonly QuoteTier[]): number | null {
  return tiers.length ? Math.min(...tiers.map((tier) => tier.minQuantity)) : null;
}

/** Thành tiền một dòng = thùng × cái/thùng × đơn giá (TC-F03-02). */
export function lineAmount(cartons: number, unitsPerCarton: number, unitPrice: number): number {
  return cartons * unitsPerCarton * unitPrice;
}

/** Tiền thuế làm tròn tới đồng (VND nguyên). */
export function taxOf(amount: number, ratePercent: number | null | undefined): number {
  return ratePercent ? Math.round((amount * ratePercent) / 100) : 0;
}

export interface PreviewItem {
  amount: number;
  taxRate?: number | null;
}

/** Tổng xem trước = Σ hàng + Σ phí + thuế từng khoản (BE vẫn là số chính thức). */
export function previewTotals(
  lines: readonly PreviewItem[],
  fees: readonly PreviewItem[],
): QuoteTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const feeSum = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const tax = [...lines, ...fees].reduce((sum, item) => sum + taxOf(item.amount, item.taxRate), 0);
  return { subtotal, fees: feeSum, tax, total: subtotal + feeSum + tax };
}

/** Tổng hiển thị: đã chấp nhận → `accepted`; còn lại → `proposed` (khi mọi dòng có giá). */
export function displayTotals(quote: Pick<Quote, "accepted" | "proposed">): QuoteTotals | null {
  return quote.accepted ?? quote.proposed ?? null;
}

export function isExpired(validUntil: string, now = Date.now()): boolean {
  return new Date(validUntil).getTime() <= now;
}

/** Phí khuôn còn chưa nhập tiền → chưa gửi được (QUOTE_PLATE_FEE_MISSING / QUOTE_NOT_PRICED). */
export function unpricedPlateFees(quote: Pick<Quote, "fees">): number {
  return quote.fees.filter((fee) => fee.kind === "PLATE_FEE" && fee.amount == null).length;
}

/** Lý do chưa gửi được (BE QUOTE_PLATE_FEE_MISSING / QUOTE_NOT_PRICED / hạn đã qua) — báo ngay trên nút. */
export function sendBlockReason(
  quote: Pick<Quote, "fees" | "priced" | "validUntil">,
): string | null {
  if (unpricedPlateFees(quote) > 0) return "Chưa nhập phí khuôn — sửa báo giá để nhập";
  if (!quote.priced) return "Còn dòng chưa có giá";
  if (isExpired(quote.validUntil)) return "Hạn hiệu lực đã qua — sửa ngày hết hiệu lực";
  return null;
}
