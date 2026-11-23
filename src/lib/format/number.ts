/**
 * Number formatting helpers.
 */

/** Format integer with locale grouping: 1234567 → "1.234.567" (vi-VN). */
export function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** Fixed fraction digits: (12.032, 3) → "12,032"; (33.1966, 2) → "33,20" (vi-VN). */
export function formatFixed(n: number, fractionDigits: number): string {
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Compact number: 1500 → "1,5K", 1200000 → "1,2M". */
export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Percentage: 0.856 → "85,6%". */
export function formatPercent(n: number, decimals = 1): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Thuế suất BE gửi dưới dạng phần trăm (8 = 8%, BE `EInvoiceLine.taxRate`: 0 tới dưới 100, tối đa 2 số lẻ):
 * 8 → "8%", 5.25 → "5,25%". Khác `formatPercent`, hàm đó nhận phân số (0.08).
 */
export function formatRatePercent(ratePercent: number): string {
  return `${formatDecimal(ratePercent, 2)}%`;
}

/** Số đo có phần lẻ, bỏ số 0 thừa: (12.5, 3) → "12,5"; (1234.5678, 2) → "1.234,57" (vi-VN). */
export function formatDecimal(n: number, maxFractionDigits: number): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: maxFractionDigits });
}
