/**
 * Mock bảng giá riêng của khách hàng — khoá (customerId, SKU đã chuẩn hoá) như unique key BE
 * `uk_customer_price`. Chỉ lưu đúng thứ BE lưu: bậc giá (đã sắp tăng dần), ghi chú, version. MOQ không
 * lưu — suy từ bậc đầu (BE `CustomerPrice.moq`). Không có tiền tệ (luôn VND), ngày hiệu lực, tên sản
 * phẩm hay mốc thời gian (BE không trả). Đơn giá giữ dạng chuỗi chữ số; route đổi sang số khi trả.
 * SKU tham chiếu mock biến thể (`mockSkuExists`), không có kho SKU thứ hai.
 */
import { mockCustomerId } from "./mock-customer-store";

export interface MockTier {
  minQuantity: number;
  /** Chữ số VND nguyên (chuỗi để giữ chính xác trong store). */
  unitPrice: string;
}

export interface MockCustomerPrice {
  customerId: string;
  sku: string;
  tiers: MockTier[];
  note: string | null;
  version: number;
}

/** Khách có bảng giá trong seed; khách 3 không có giá nào (trường hợp C). */
export const PRICED_CUSTOMER = mockCustomerId(1);
export const OTHER_PRICED_CUSTOMER = mockCustomerId(2);
export const UNPRICED_CUSTOMER = mockCustomerId(3);

const keyOf = (customerId: string, sku: string) => `${customerId.toLowerCase()}|${sku}`;
const sorted = (tiers: readonly MockTier[]) =>
  [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

function seed(): Map<string, MockCustomerPrice> {
  const rows: MockCustomerPrice[] = [
    // A + E: nhiều bậc, bậc đầu từ 10 (MOQ 10)
    {
      customerId: PRICED_CUSTOMER,
      sku: "SKU-001-BLK-L",
      tiers: [
        { minQuantity: 10, unitPrice: "95000" },
        { minQuantity: 100, unitPrice: "90000" },
      ],
      note: "Giá đại lý cấp 1",
      version: 2,
    },
    // A + D: một bậc
    {
      customerId: PRICED_CUSTOMER,
      sku: "SKU-002-WHT",
      tiers: [{ minQuantity: 1, unitPrice: "150000" }],
      note: null,
      version: 0,
    },
    // A + F: giá TĂNG theo số lượng (BE không ép giảm dần)
    {
      customerId: PRICED_CUSTOMER,
      sku: "SKU-003-WHT-L",
      tiers: [
        { minQuantity: 1, unitPrice: "50000" },
        { minQuantity: 50, unitPrice: "52000" },
      ],
      note: null,
      version: 1,
    },
    // B: khách khác, cùng SKU với khách A — giá độc lập
    {
      customerId: OTHER_PRICED_CUSTOMER,
      sku: "SKU-001-BLK-L",
      tiers: [{ minQuantity: 5, unitPrice: "99000" }],
      note: null,
      version: 0,
    },
  ];
  return new Map(rows.map((r) => [keyOf(r.customerId, r.sku), r]));
}

let store: Map<string, MockCustomerPrice> | null = null;
const prices = () => (store ??= seed());

export function resetCustomerPriceMockStore(): void {
  store = null;
}

/** BE `ofCustomer`: của đúng khách, lọc SKU (đã chuẩn hoá) nếu có, sắp theo SKU. */
export function customerPricesOf(customerId: string, skus: readonly string[]): MockCustomerPrice[] {
  const id = customerId.toLowerCase();
  return [...prices().values()]
    .filter((p) => p.customerId === id && (skus.length === 0 || skus.includes(p.sku)))
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}

/**
 * BE `inventory.item_in_use`: có giá riêng của BẤT KỲ khách nào cho SKU (`catalog.customer_price.sku`) → SKU
 * đã được dùng, biến thể nháp không đổi SKU được nữa. Đọc qua `prices()` nên kho chưa nạp vẫn gieo đúng.
 */
export function mockCustomerPriceUsesSku(sku: string): boolean {
  return [...prices().values()].some((p) => p.sku === sku);
}

export function findCustomerPrice(customerId: string, sku: string): MockCustomerPrice | null {
  return prices().get(keyOf(customerId, sku)) ?? null;
}

/** Ghi bản đã kiểm (bậc sắp tăng dần như BE `CustomerPrice.validated`). */
export function saveCustomerPrice(price: MockCustomerPrice): MockCustomerPrice {
  const saved = {
    ...price,
    customerId: price.customerId.toLowerCase(),
    tiers: sorted(price.tiers),
  };
  prices().set(keyOf(saved.customerId, saved.sku), saved);
  return saved;
}

/**
 * Chỉ cho test: gieo một bản ghi tuỳ ý (vd đơn giá vượt số nguyên an toàn của JavaScript để kiểm cờ
 * `unitPriceExact` phía FE). Như `SupplierItemFixtures` của BE — không đi qua luật của route.
 */
export function seedMockCustomerPrice(price: MockCustomerPrice): MockCustomerPrice {
  return saveCustomerPrice(price);
}
