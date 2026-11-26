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
