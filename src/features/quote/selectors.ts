/**
 * Selector thuần cho báo giá. Giá thật do BE tính — các hàm ở đây chỉ để XEM TRƯỚC trên form /
 * portal và luôn ghi rõ "tạm tính"; số liệu chốt luôn đọc lại từ response BE.
 */

import type { Quote, QuoteLine } from "./types";

export interface Tier {
  minQuantity: number;
  unitPrice: number;
}

/**
 * P5 (SPRINT2-BE-EXECUTION 2026-10-12): cộng SL các dòng CÙNG mã phôi (mọi thiết kế) để chọn bậc
 * giá; không cộng chéo mã phôi khác.
 */
export function blankUnits(
  lines: readonly { blankSku: string; quantity: number }[],
): Map<string, number> {
  const units = new Map<string, number>();
  for (const line of lines) {
    const sku = line.blankSku.trim().toUpperCase();
    units.set(sku, (units.get(sku) ?? 0) + (Number.isFinite(line.quantity) ? line.quantity : 0));
  }
  return units;
}

/**
 * Bậc giá có `minQuantity` lớn nhất ≤ tổng phôi. P4: dưới bậc thấp nhất → `null` (KHÔNG dùng giá
 * bậc thấp nhất cho SL nhỏ hơn; BE trả QUOTE_BELOW_MOQ).
 */
export function tierPrice(tiers: readonly Tier[], units: number): number | null {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const first = sorted[0];
  if (!first || units < first.minQuantity) return null;
  return sorted.filter((tier) => tier.minQuantity <= units).at(-1)?.unitPrice ?? null;
}

/** Dòng cần khách duyệt mẫu trước khi chấp nhận (BR-PRD-08: thiết kế mới chưa có mẫu đạt). */
export function linesNeedingSample(quote: Pick<Quote, "lines">): QuoteLine[] {
  return quote.lines.filter((line) => !line.sample.satisfied);
}

/** Tổng hiển thị: đã chấp nhận → acceptedTotal; còn lại → proposedTotal (nếu mọi dòng có giá). */
export function displayTotal(quote: Pick<Quote, "acceptedTotal" | "proposedTotal">): number | null {
  return quote.acceptedTotal ?? quote.proposedTotal ?? null;
}

export function isExpired(validUntil: string, now = Date.now()): boolean {
  return new Date(validUntil).getTime() <= now;
}
