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

/** Lọc trên header cột của bảng giá một khách — chuỗi chữ số trên URL, rỗng = không chặn đầu đó. */
export interface PriceColumnFilters {
  sku: string;
  moqFrom: string;
  moqTo: string;
  tiersFrom: string;
  tiersTo: string;
  lowestFrom: string;
  lowestTo: string;
  highestFrom: string;
  highestTo: string;
}

/** Bỏ số 0 đầu để so theo chuỗi chữ số như `compareWholeDigits` ("0790" → "790"). */
const wholeDigits = (text: string) => text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** Số lượng (số nguyên nhỏ) nằm trong khoảng. */
function inNumberRange(value: number, from: string, to: string): boolean {
  const lo = wholeDigits(from);
  const hi = wholeDigits(to);
  return (lo === "" || value >= Number(lo)) && (hi === "" || value <= Number(hi));
}

/** Tiền (chuỗi chữ số VND) nằm trong khoảng — so theo chuỗi, không qua `Number`. */
function inMoneyRange(value: string, from: string, to: string): boolean {
  const lo = wholeDigits(from);
  const hi = wholeDigits(to);
  return (
    (lo === "" || compareWholeDigits(value, lo) >= 0) &&
    (hi === "" || compareWholeDigits(value, hi) <= 0)
  );
}

/**
 * Dòng giá khớp mọi lọc cột: SKU chứa chữ (chuẩn hoá như BE), MOQ / số bậc / giá thấp nhất / cao nhất trong khoảng. Giá có
 * bậc không chính xác (`exact` sai) không khớp khi đang lọc giá — không trình bày số không chắc chắn như số đã lọc.
 */
export function matchesPriceColumns(price: CustomerPrice, f: PriceColumnFilters): boolean {
  const sku = f.sku.trim().toUpperCase();
  if (sku !== "" && !price.sku.includes(sku)) return false;
  if (!inNumberRange(price.moq, f.moqFrom, f.moqTo)) return false;
  if (!inNumberRange(price.tiers.length, f.tiersFrom, f.tiersTo)) return false;
  const filteringPrice = Boolean(f.lowestFrom || f.lowestTo || f.highestFrom || f.highestTo);
  if (!filteringPrice) return true;
  const range = priceRange(price);
  return (
    range.exact &&
    inMoneyRange(range.lowest, f.lowestFrom, f.lowestTo) &&
    inMoneyRange(range.highest, f.highestFrom, f.highestTo)
  );
}
