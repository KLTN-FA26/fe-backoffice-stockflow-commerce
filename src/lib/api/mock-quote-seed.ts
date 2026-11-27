/**
 * Dữ liệu gốc WF-02 cho mock báo giá / hợp đồng — CHỈ lấy từ seed demo của BE (origin/develop,
 * `src/main/resources/db/demo/`), không bịa bản ghi:
 * - `V20261111000001__demo_seed.sql`: khách "Khách hàng demo" (`c0000000-…-0001`).
 * - `V20261124000600__demo_wf02.sql`: tài khoản demo.sales / demo.khachhang, hồ sơ pháp lý + địa chỉ + hạn mức 500 triệu /
 *   30 ngày của khách demo, SKU riêng `LY-GIAY-DEMO-12OZ-XANH` (1.000 cái / thùng, chưa sản xuất lần nào → có phí khuôn),
 *   giá riêng 20/50/100 thùng = 1.250/1.150/1.050 đ một cái, bên bán của hợp đồng.
 * - `V20261128000200__demo_history.sql`: khách "Công ty CP Trà Sữa Mây" (TSM), SKU `LY-GIAY-DEMO-12OZ-TSM` (đã sản xuất ở
 *   O01/O02/O08 → không phí khuôn), giá 1.300/1.200/1.100, hạn mức 300 triệu / 15 ngày; đợt sau giao của O01
 *   (41.195.000 đ) chưa trả và đã quá hạn — dư nợ duy nhất của TSM (O02, O08 đã trả đủ).
 * Id = `md5('demo:…')::uuid` như BE `DemoData.demoId`. Chỉ các file `mock-*` đọc file này.
 */

import type { MockCustomerPrice } from "./mock-customer-price-store";
import type { MockCustomer } from "./mock-customer-store";

const ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 86_400_000;

/* ── Ngày theo giờ Việt Nam ──────────────────────────────────────────── */

/** Ngày làm việc ở Việt Nam (`YYYY-MM-DD`) của một thời điểm. */
export const vnDay = (at: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(at);

/** Cộng ngày cho một ngày `YYYY-MM-DD`. */
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** `days` ngày trước hôm nay (giờ VN), lúc `hhmm` giờ VN — như `pg_temp.at` của seed lịch sử. */
export const vnInstantDaysAgo = (days: number, hhmm: string): string =>
  new Date(`${addDays(vnDay(), -days)}T${hhmm}:00+07:00`).toISOString();

/** Thời điểm cách bây giờ `hours` giờ (âm = đã qua) — như `NOW() ± INTERVAL` của seed WF-02. */
export const instantFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

/* ── Người dùng demo (V20261124000600 §1, V20261128000200 §3) ────────── */

export const WF02_USERS = {
  sales: "aa40c7cb-70b4-2d3a-f730-e2b5a217c662",
  accountant: "51006eb7-6142-e871-35a0-5138a7ed2cf5",
  demoCustomer: "82c2b7d7-c0ae-51e1-4414-23e2e625febb",
  tsmCustomer: "0fcea640-771a-22a6-4ab9-eef1e9e2016a",
} as const;

/* ── Khách hàng ──────────────────────────────────────────────────────── */

export const WF02_DEMO_CUSTOMER_ID = "c0000000-0000-4000-8000-000000000001";
export const WF02_TSM_CUSTOMER_ID = "d0938090-20ac-ae0d-e6ce-aae90663ac33";

/** Bên hợp đồng (BE `ContractParty`). */
export interface Wf02Party {
  name: string;
  taxCode: string | null;
  address: string | null;
  representative: string | null;
  representativeTitle: string | null;
}

/** Địa chỉ mặc định của khách (BE `customer.address`, `is_default`). */
export interface Wf02Address {
  recipientName: string;
  phone: string;
  line1: string;
  wardCode: string;
  wardName: string;
  provinceCode: string;
  provinceName: string;
  countryCode: string;
}

/** Hạn mức (BE `customer.credit_profile`) + dư nợ các hợp đồng đã ký trước đó (BE `creditPosition`). */
export interface Wf02Credit {
  creditLimit: number;
  creditTermDays: number;
  exposure: number;
  hasOverdue: boolean;
}

export interface Wf02CustomerSeed {
  customerId: string;
  /** Người nhận / liên hệ của đơn (cột `contact_*` của đơn seed). */
  contact: { name: string; email: string; phone: string };
  buyer: Wf02Party;
  shipping: Wf02Address;
  billing: Wf02Address;
  credit: Wf02Credit | null;
}

/** Bên bán — đúng các cột `seller_*` của hai hợp đồng seed. */
export const WF02_SELLER: Wf02Party = {
  name: "DEMO STOCKFLOW CO LTD",
  taxCode: "0000000000",
  address: "1 Demo Street, Ho Chi Minh City",
  representative: "Demo Director",
  representativeTitle: "Director",
};

const address = (
  recipientName: string,
  phone: string,
  line1: string,
  wardCode: string,
  wardName: string,
): Wf02Address => ({
  recipientName,
  phone,
  line1,
  wardCode,
  wardName,
  provinceCode: "79",
  provinceName: "TP. Hồ Chí Minh",
  countryCode: "VN",
});

export const WF02_CUSTOMERS: readonly Wf02CustomerSeed[] = [
  {
    customerId: WF02_DEMO_CUSTOMER_ID,
    contact: {
      name: "Nguyễn Thị Khách",
      email: "demo.customer@stockflow.local",
      phone: "0900000001",
    },
    buyer: {
      name: "Khách hàng demo",
      taxCode: "0399990001",
      address: "12 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh",
      representative: "Nguyễn Thị Khách",
      representativeTitle: "Giám đốc",
    },
    shipping: address(
      "Nguyễn Thị Khách",
      "0900000001",
      "12 Nguyễn Huệ",
      "26734",
      "Phường Bến Nghé",
    ),
    billing: address("Khách hàng demo", "0900000001", "12 Nguyễn Huệ", "26734", "Phường Bến Nghé"),
    credit: { creditLimit: 500_000_000, creditTermDays: 30, exposure: 0, hasOverdue: false },
  },
  {
    customerId: WF02_TSM_CUSTOMER_ID,
    contact: { name: "Trần Thị Mây", email: "muahang.tsm@stockflow.local", phone: "0901110012" },
    buyer: {
      name: "Công ty CP Trà Sữa Mây",
      taxCode: "0399990012",
      address: "18 Võ Văn Tần, Phường Xuân Hòa, TP. Hồ Chí Minh",
      representative: "Trần Thị Mây",
      representativeTitle: "Giám đốc",
    },
    shipping: address("Trần Thị Mây", "0901110012", "18 Võ Văn Tần", "27142", "Phường Xuân Hòa"),
    billing: address(
      "Công ty CP Trà Sữa Mây",
      "0901110012",
      "18 Võ Văn Tần",
      "27142",
      "Phường Xuân Hòa",
    ),
    // O01: 40 thùng × 1.300 + phí khuôn, VAT 10% = 58.850.000; cọc 30% đã trả, phần sau giao 41.195.000 chưa trả
    credit: {
      creditLimit: 300_000_000,
      creditTermDays: 15,
      exposure: 41_195_000,
      hasOverdue: true,
    },
  },
];

export const wf02Customer = (customerId: string): Wf02CustomerSeed | undefined =>
  WF02_CUSTOMERS.find((c) => c.customerId === customerId.toLowerCase());

/**
 * Hai khách WF-02 theo hình `MockCustomer` (BE `CustomerResponse`) — cho `findMockCustomer` (tên khách, kiểm khách của
 * giá riêng). Không nằm trong danh sách `/customers` của mock khách hàng (giữ nguyên 45 khách mà test của module đó đếm).
 */
export function wf02MockCustomer(customerId: string): MockCustomer | null {
  const id = customerId.toLowerCase();
  if (id === WF02_DEMO_CUSTOMER_ID) {
    return {
      customerId: id,
      userId: WF02_USERS.demoCustomer,
      fullName: "Khách hàng demo",
      email: "demo.customer@stockflow.local",
      phone: "0900000001",
      taxCode: "0399990001",
      segmentId: null,
      status: "ACTIVE",
      version: 0,
      createdAt: "2026-11-11T13:19:24.948Z",
    };
  }
  if (id === WF02_TSM_CUSTOMER_ID) {
    return {
      customerId: id,
      userId: WF02_USERS.tsmCustomer,
      fullName: "Công ty CP Trà Sữa Mây",
      email: "muahang.tsm@stockflow.local",
      phone: "0901110012",
      taxCode: "0399990012",
      segmentId: null,
      status: "ACTIVE",
      version: 0,
      // `since` 136 ngày trước ngày dựng DB, 09:00
      createdAt: vnInstantDaysAgo(136, "09:00"),
    };
  }
  return null;
}

/* ── SKU riêng của khách (01 BR-03) ──────────────────────────────────── */

export const XANH_SKU = "LY-GIAY-DEMO-12OZ-XANH";
export const TSM_SKU = "LY-GIAY-DEMO-12OZ-TSM";

/** BE `product.api.CustomerSku` + quy cách thùng, nhóm thuế, đã từng sản xuất (14 BR-17). */
export interface Wf02Sku {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  ownerCustomerId: string;
  designSnapshotId: string;
  sourceSku: string;
  status: "ACTIVE";
  unitsPerCarton: number;
  taxClass: string;
  producedBefore: boolean;
}

const PRODUCT_LY_GIAY_DEMO = "32c25816-da24-fb3a-d680-c66c93570274";

export const WF02_SKUS: readonly Wf02Sku[] = [
  {
    variantId: "90b49fe8-3d63-57f8-096e-0c7b820080d6",
    productId: PRODUCT_LY_GIAY_DEMO,
    sku: XANH_SKU,
    name: "Ly giấy 2 lớp in logo - 12 oz - logo xanh",
    ownerCustomerId: WF02_DEMO_CUSTOMER_ID,
    designSnapshotId: "f8b7c098-cfb5-81f1-5cdb-a50a646a02a4",
    sourceSku: "LY-GIAY-DEMO-12OZ",
    status: "ACTIVE",
    unitsPerCarton: 1000,
    taxClass: "STANDARD",
    producedBefore: false,
  },
  {
    variantId: "6b246983-0f50-b205-73c2-6811f46f10cb",
    productId: PRODUCT_LY_GIAY_DEMO,
    sku: TSM_SKU,
    name: "Ly giấy 2 lớp in logo - 12 oz - Công ty CP Trà Sữa Mây",
    ownerCustomerId: WF02_TSM_CUSTOMER_ID,
    designSnapshotId: "91b7559c-b996-cf19-6562-49d1ae5a4a72",
    sourceSku: "LY-GIAY-DEMO-12OZ",
    status: "ACTIVE",
    unitsPerCarton: 1000,
    taxClass: "STANDARD",
    producedBefore: true,
  },
];

export const wf02Sku = (sku: string): Wf02Sku | undefined =>
  WF02_SKUS.find((s) => s.sku === sku.trim().toUpperCase());

/** `GET /customer-skus?customerId=&productId=` — SKU riêng của khách, đúng hình BE `CustomerSkuResponse` (id tên `id`). */
export function wf02CustomerSkus(customerId: string, productId: string | null) {
  return WF02_SKUS.filter(
    (s) =>
      s.ownerCustomerId === customerId.toLowerCase() && (!productId || s.productId === productId),
  ).map((s) => ({
    id: s.variantId,
    productId: s.productId,
    sku: s.sku,
    name: s.name,
    ownerCustomerId: s.ownerCustomerId,
    designSnapshotId: s.designSnapshotId,
    sourceSku: s.sourceSku,
    status: s.status,
  }));
}

/** Giá riêng theo thùng (13 BR-05, `catalog.customer_price`): bậc đầu là MOQ. Gieo vào mock giá riêng. */
export const WF02_CUSTOMER_PRICES: readonly MockCustomerPrice[] = [
  {
    customerId: WF02_DEMO_CUSTOMER_ID,
    sku: XANH_SKU,
    tiers: [
      { minQuantity: 20, unitPrice: "1250" },
      { minQuantity: 50, unitPrice: "1150" },
      { minQuantity: 100, unitPrice: "1050" },
    ],
    note: "Bảng giá nội bộ theo số thùng (giá một ly)",
    version: 0,
  },
  {
    customerId: WF02_TSM_CUSTOMER_ID,
    sku: TSM_SKU,
    tiers: [
      { minQuantity: 20, unitPrice: "1300" },
      { minQuantity: 50, unitPrice: "1200" },
      { minQuantity: 100, unitPrice: "1100" },
    ],
    note: "Bảng giá nội bộ theo số thùng (giá một ly)",
    version: 0,
  },
];

/* ── Thuế suất (BE `TaxRates.onDay`, 14 BR-21) ───────────────────────── */

/** `ordering.tax_rate` (baseline). */
const TAX_RATES: Readonly<Record<string, number>> = { STANDARD: 10, REDUCED: 5, EXEMPT: 0 };

/** `ordering.tax_rate_period` (V20261201000200): NĐ 174/2025, STANDARD 8% từ 01/07/2025 đến 31/12/2026. */
const TAX_RATE_PERIODS = [
  { taxClass: "STANDARD", rate: 8, validFrom: "2025-07-01", validTo: "2026-12-31" },
] as const;

/** Thuế suất của nhóm thuế vào ngày `day` — kỳ giảm thuế nếu có, không thì thuế suất của nhóm. */
export function taxRateOn(taxClass: string, day: string): number | null {
  const period = TAX_RATE_PERIODS.find(
    (p) => p.taxClass === taxClass && p.validFrom <= day && day <= p.validTo,
  );
  return period ? period.rate : (TAX_RATES[taxClass] ?? null);
}
