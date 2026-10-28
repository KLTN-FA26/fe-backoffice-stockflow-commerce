/**
 * Hàm thuần cho màn bảng giá khách hàng — không đổi dữ liệu đầu vào (mảng trong cache React Query).
 * Đơn giá là chuỗi chữ số VND nguyên (`schemas.ts`), so sánh theo chuỗi — không qua `Number`.
 */
import type { CustomerPrice, CustomerPriceTier } from "./schemas";

/** So hai chuỗi chữ số nguyên chuẩn (không số 0 đầu): dài hơn là lớn hơn, cùng độ dài thì theo chữ. */
export function compareWholeDigits(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface PriceRange {
  lowest: string;
  highest: string;
  /** Mọi bậc đều chính xác — sai thì thấp nhất / cao nhất có thể đã lệch (JSON làm tròn). */
  exact: boolean;
}

/**
 * Giá thấp nhất / cao nhất qua MỌI bậc — không lấy bậc đầu / cuối: giá không bắt buộc giảm theo số
 * lượng (docs/handoffs/SPRINT2-PRICING-PLAN.md P3, BE `CustomerPrice` không ép thứ tự giá).
 */
export function priceRange(price: CustomerPrice): PriceRange {
  const [first, ...rest] = price.tiers;
  let lowest = first?.unitPrice ?? "";
  let highest = lowest;
  for (const tier of rest) {
    if (compareWholeDigits(tier.unitPrice, lowest) < 0) lowest = tier.unitPrice;
    if (compareWholeDigits(tier.unitPrice, highest) > 0) highest = tier.unitPrice;
  }
  return { lowest, highest, exact: price.tiers.every((t) => t.unitPriceExact) };
}

/** Bậc theo `minQuantity` tăng dần (BE đã sắp; sắp lại trên bản sao cho chắc). */
export function tiersAscending(price: CustomerPrice): CustomerPriceTier[] {
  return [...price.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Lọc phía FE theo SKU (chuẩn hoá như BE: bỏ khoảng trắng, in hoa) — trả mảng mới. */
export function filterPricesBySku(
  prices: readonly CustomerPrice[],
  query: string,
): CustomerPrice[] {
  const term = query.trim().toUpperCase();
  return term === "" ? [...prices] : prices.filter((p) => p.sku.includes(term));
}

/** Khách ngừng hoạt động / bị khoá: vẫn chọn được (BE nhận giá ở mọi trạng thái), chỉ cảnh báo. */
export const needsStatusWarning = (status: string): boolean =>
  status === "INACTIVE" || status === "BLOCKED";
