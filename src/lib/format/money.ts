/**
 * Money formatting — single source of truth.
 *
 * Replaces per-page `formatUSD`, `formatCompactVND`, etc.
 * Currency always comes from the record's `currency` field (BR-07 module 02).
 */

import type { Currency } from "@/lib/mock-data";

/**
 * Mã tiền tệ ISO 4217. `Currency` gợi ý các mã mock đang dùng, nhưng record từ BE có thể mang
 * mã khác (vd `OrderResponse.currency`) — Intl.NumberFormat định dạng được mọi mã hợp lệ.
 */
export type CurrencyCode = Currency | (string & {});

/** Full precision money format. */
export function formatMoney(amount: number, currency: CurrencyCode = "VND"): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount);
}

/** Compact format for stats tiles: "1,2 tỷ ₫", "345 tr ₫". */
export function formatCompact(amount: number, currency: CurrencyCode = "VND"): string {
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
