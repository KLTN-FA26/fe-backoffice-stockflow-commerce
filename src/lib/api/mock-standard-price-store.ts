/**
 * Mock giá chuẩn theo quy cách — khoá theo SKU quy cách đã chuẩn hoá (BE `uk_standard_price_sku`). Chỉ lưu đúng thứ BE
 * lưu: bậc giá (sắp tăng dần), ghi chú, version; tên sản phẩm / quy cách tra lúc trả (BE `StandardPriceService.view`).
 * Seed lấy từ demo BE `V20261230000300__demo_standard_prices.sql`: ly giấy 12 oz demo (quy cách của SKU riêng
 * `LY-GIAY-DEMO-12OZ-XANH` / `-TSM`) 10/20/50/100 thùng = 1.300/1.250/1.150/1.050 đ một cái. Ly tre chỉ có ở bản dựng có
 * demo WF-05 nên không gieo; hộp giấy cố ý không có giá chuẩn.
 */

export interface MockStandardTier {
  minQuantity: number;
  /** Chữ số VND nguyên (chuỗi để giữ chính xác trong store). */
  unitPrice: string;
}

export interface MockStandardPrice {
  sku: string;
  tiers: MockStandardTier[];
  note: string | null;
  version: number;
}

/** Quy cách của ly giấy demo (BE `V20261124000600` §3) — không có trong mock biến thể của màn sản phẩm. */
export const DEMO_CUP_VARIANT = {
  sku: "LY-GIAY-DEMO-12OZ",
  productName: "Ly giấy 2 lớp in logo (demo)",
  variantName: "Ly giấy 2 lớp in logo - 12 oz",
} as const;

const sorted = (tiers: readonly MockStandardTier[]) =>
  [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

function seed(): Map<string, MockStandardPrice> {
  const rows: MockStandardPrice[] = [
    {
      sku: DEMO_CUP_VARIANT.sku,
      tiers: [
        { minQuantity: 10, unitPrice: "1300" },
        { minQuantity: 20, unitPrice: "1250" },
        { minQuantity: 50, unitPrice: "1150" },
        { minQuantity: 100, unitPrice: "1050" },
      ],
      note: "Giá chuẩn cho mẫu in thông thường (1-2 màu)",
      version: 0,
    },
  ];
  return new Map(rows.map((r) => [r.sku, r]));
}

let store: Map<string, MockStandardPrice> | null = null;
const prices = () => (store ??= seed());

export function resetStandardPriceMockStore(): void {
  store = null;
}

/** BE `list`: lọc SKU (đã chuẩn hoá) nếu có, sắp theo SKU. */
export function standardPricesOf(skus: readonly string[]): MockStandardPrice[] {
  return [...prices().values()]
    .filter((p) => skus.length === 0 || skus.includes(p.sku))
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}

export function findStandardPrice(sku: string): MockStandardPrice | null {
  return prices().get(sku.trim().toUpperCase()) ?? null;
}

/** Ghi bản đã kiểm (bậc sắp tăng dần như BE `PriceTiers`). */
export function saveStandardPrice(price: MockStandardPrice): MockStandardPrice {
  const saved = { ...price, tiers: sorted(price.tiers) };
  prices().set(saved.sku, saved);
  return saved;
}

export function deleteStandardPrice(sku: string): void {
  prices().delete(sku);
}
