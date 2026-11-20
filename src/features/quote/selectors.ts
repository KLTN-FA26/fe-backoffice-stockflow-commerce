/**
 * Selector thuần cho báo giá theo thùng. Giá thật do BE tính — các hàm ở đây chỉ để XEM TRƯỚC trên
 * form và luôn ghi rõ "tạm tính"; số chốt luôn đọc lại từ `proposed` / `accepted` của BE.
 */

import type { Quote, QuoteLine, QuoteTier, QuoteTotals, QuoteTransition } from "./types";

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

/**
 * Tổng hiển thị: đã chấp nhận → `accepted`; còn lại → `proposed`. Thiếu tạm tính / phí / thuế / tổng (còn khoản chưa giá, BE bỏ
 * trường null) → null: màn hình báo "chưa đủ giá" thay vì in số thiếu.
 */
export function displayTotals(quote: Pick<Quote, "accepted" | "proposed">): QuoteTotals | null {
  const totals = quote.accepted ?? quote.proposed;
  if (
    !totals ||
    totals.subtotal == null ||
    totals.fees == null ||
    totals.tax == null ||
    totals.total == null
  )
    return null;
  return { subtotal: totals.subtotal, fees: totals.fees, tax: totals.tax, total: totals.total };
}

export function isExpired(validUntil: string, now = Date.now()): boolean {
  return new Date(validUntil).getTime() <= now;
}

/** Phí khuôn còn chưa nhập tiền → chưa gửi được (QUOTE_PLATE_FEE_MISSING / QUOTE_NOT_PRICED). */
export function unpricedPlateFees(quote: Pick<Quote, "fees">): number {
  return quote.fees.filter((fee) => fee.kind === "PLATE_FEE" && fee.amount == null).length;
}

/**
 * Lý do chưa gửi được (BE QUOTE_PLATE_FEE_MISSING / QUOTE_NOT_PRICED / QUOTE_TAX_CLASS_MISSING / hạn đã qua) —
 * báo ngay trên nút.
 */
export function sendBlockReason(
  quote: Pick<Quote, "fees" | "priced" | "validUntil"> & {
    lines: readonly Pick<QuoteLine, "lineNo" | "sku" | "taxRate">[];
  },
): string | null {
  if (unpricedPlateFees(quote) > 0) return "Chưa nhập phí khuôn — sửa báo giá để nhập";
  if (!quote.priced) return "Còn dòng chưa có giá";
  // BE `Quote.send`: dòng / phí chưa có thuế suất → 409 QUOTE_TAX_CLASS_MISSING.
  const noTaxLine = quote.lines.find((line) => line.taxRate == null);
  if (noTaxLine)
    return `Dòng ${noTaxLine.lineNo} (${noTaxLine.sku}): sản phẩm chưa có nhóm thuế — nhờ quản lý sản phẩm khai báo trước khi gửi`;
  // Chỉ phí khuôn (gắn SKU) lấy thuế từ sản phẩm; phí vận chuyển BE không đòi.
  const noTaxFee = quote.fees.find((fee) => fee.kind === "PLATE_FEE" && fee.taxRate == null);
  if (noTaxFee)
    return `Phí khuôn ${noTaxFee.sku ?? ""}: sản phẩm chưa có nhóm thuế`.replace("  ", " ");
  if (isExpired(quote.validUntil)) return "Hạn hiệu lực đã qua — sửa ngày hết hiệu lực";
  return null;
}

/**
 * Yêu cầu sửa gần nhất của khách: dòng lịch sử cuối có `toStatus === CHANGES_REQUESTED` (BE xoá `customerFeedback`
 * khi mở bản sửa nên ý khách chỉ còn ở đây). Lịch sử xếp cũ nhất trước.
 */
export function lastChangeRequest(
  history: readonly Pick<QuoteTransition, "revision" | "toStatus" | "reason" | "changedAt">[],
): { feedback: string | null; at: string; revision: number } | null {
  const row = history.findLast((entry) => entry.toStatus === "CHANGES_REQUESTED");
  return row ? { feedback: row.reason, at: row.changedAt, revision: row.revision } : null;
}
