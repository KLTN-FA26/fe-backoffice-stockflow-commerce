/**
 * Hàm thuần cho màn giá chuẩn — không đổi dữ liệu đầu vào (mảng trong cache React Query).
 */
import type { StandardPrice } from "./schemas";

/** Bỏ dấu tiếng Việt + chữ thường để lọc "ly giay" khớp "Ly giấy". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

/** Lọc phía FE theo SKU, tên sản phẩm hoặc tên quy cách (không phân biệt hoa thường, dấu) — trả mảng mới. */
export function filterStandardPrices(
  prices: readonly StandardPrice[],
  query: string,
): StandardPrice[] {
  const term = fold(query.trim());
  if (term === "") return [...prices];
  return prices.filter((p) =>
    [p.sku, p.productName ?? "", p.variantName ?? ""].some((field) => fold(field).includes(term)),
  );
}

/** SKU đã có giá chuẩn (chuẩn hoá như BE) — ô chọn quy cách đánh dấu để không tạo trùng. */
export const pricedSkus = (prices: readonly StandardPrice[]): ReadonlySet<string> =>
  new Set(prices.map((p) => p.sku.trim().toUpperCase()));

/**
 * So hai số thập phân dạng chữ không âm (`"1300"`, `"1250.5"`) — không qua `Number` để không làm tròn: phần nguyên theo độ
 * dài rồi theo chữ, sau đó phần lẻ (bù 0 bên phải).
 */
export function compareDecimalText(a: string, b: string): number {
  const [ai = "", af = ""] = a.replace(/^0+(?=\d)/, "").split(".");
  const [bi = "", bf = ""] = b.replace(/^0+(?=\d)/, "").split(".");
  if (ai.length !== bi.length) return ai.length - bi.length;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const len = Math.max(af.length, bf.length);
  const fa = af.padEnd(len, "0");
  const fb = bf.padEnd(len, "0");
  return fa < fb ? -1 : fa > fb ? 1 : 0;
}

export interface StandardPriceColumnFilters {
  sku: string;
  product: string;
  variant: string;
  /** Khoảng đơn giá (chữ số); dòng khớp khi có ít nhất một bậc nằm trong khoảng. */
  priceFrom: string;
  priceTo: string;
}

/** Lọc trên header cột (bỏ dấu, không phân biệt hoa thường; ô rỗng = không lọc cột đó). */
export function matchesStandardPriceColumns(
  price: StandardPrice,
  filters: StandardPriceColumnFilters,
): boolean {
  const sku = fold(filters.sku.trim());
  const product = fold(filters.product.trim());
  const variant = fold(filters.variant.trim());
  const from = filters.priceFrom.replace(/\D/g, "");
  const to = filters.priceTo.replace(/\D/g, "");
  return (
    (sku === "" || fold(price.sku).includes(sku)) &&
    (product === "" || fold(price.productName ?? "").includes(product)) &&
    (variant === "" || fold(price.variantName ?? "").includes(variant)) &&
    ((from === "" && to === "") ||
      price.tiers.some(
        (tier) =>
          (from === "" || compareDecimalText(tier.unitPrice, from) >= 0) &&
          (to === "" || compareDecimalText(tier.unitPrice, to) <= 0),
      ))
  );
}
