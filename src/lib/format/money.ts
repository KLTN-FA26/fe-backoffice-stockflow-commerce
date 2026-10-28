/**
 * Money formatting — single source of truth.
 *
 * Replaces per-page `formatUSD`, `formatCompactVND`, etc.
 * Currency always comes from the record's `currency` field (BR-07 module 02).
 */

/**
 * Full precision money format.
 *
 * `currency` is any ISO 4217 code the record carries (BE accepts any 3-letter code, e.g. a
 * PO in EUR). Never silently re-label an amount as VND: an unknown/invalid code falls back
 * to "<amount> <CODE>" so the original currency stays visible.
 */
export function formatMoney(amount: number, currency: string = "VND"): string {
  try {
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "vi-VN", {
      style: "currency",
      currency,
      // Theo ISO 4217 của chính tiền tệ (VND/JPY 0, USD/EUR 2) — khớp BE `Money`.
      maximumFractionDigits: currencyFractionDigits(currency),
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/**
 * Số chữ số thập phân chuẩn ISO 4217 của tiền tệ (VND 0, USD/CNY/EUR 2). Khớp
 * `java.util.Currency#getDefaultFractionDigits` mà BE `Money` dùng để làm tròn HALF_UP —
 * nhập lẻ hơn mức này thì BE âm thầm làm tròn, tổng FE sẽ lệch tổng BE lưu.
 */
export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** `amount` có không quá số chữ số thập phân của `currency` (VND: số nguyên). */
export function fitsCurrencyScale(amount: number, currency: string): boolean {
  const factor = 10 ** currencyFractionDigits(currency);
  const scaled = amount * factor;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/**
 * Số tiền dạng CHUỖI thập phân chính xác (BE `BigDecimal`, vd giá mua tham khảo của SKU). `Intl`
 * định dạng thẳng chuỗi số — không qua số thực — và giữ đúng mọi chữ số lẻ có trong chuỗi (tối đa
 * `maxFractionDigits`), không làm tròn về số lẻ ISO của tiền tệ như `formatMoney`: BE cho giá tham
 * khảo 2 chữ số lẻ với mọi tiền tệ, kể cả VND. Tiền tệ lạ → "<số> <MÃ>" như `formatMoney`.
 */
export function formatDecimalMoney(
  amount: string,
  currency: string,
  maxFractionDigits = 2,
): string {
  if (!DECIMAL_TEXT.test(amount)) return `${amount} ${currency}`;
  // Đã kiểm dạng số thập phân ở trên — đúng kiểu chuỗi số của `Intl.NumberFormat.format`
  const value = amount as `${number}`;
  try {
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "vi-VN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    }).format(value);
  } catch {
    const plain = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: maxFractionDigits });
    return `${plain.format(value)} ${currency}`;
  }
}

/** Compact format for stats tiles: "1,2 tỷ ₫", "345 tr ₫". */
export function formatCompact(amount: number, currency: string = "VND"): string {
  if (currency !== "VND") return formatMoney(amount, currency);
  if (amount >= 1_000_000_000)
    return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ ₫`;
  if (amount >= 1_000_000)
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr ₫`;
  return formatMoney(amount, currency);
}

/** VND shorthand (backwards compat). */
export function formatVND(amount: number): string {
  return formatMoney(amount, "VND");
}
