/**
 * Mock khách hàng — hình BE `CustomerResponse` (customerId, userId, fullName, email, phone, taxCode,
 * segmentId, status, version, createdAt). KHÔNG có mã khách hay loại khách (BE không có). Id dạng UUID
 * như BE; không lấy tên khách của mock đơn hàng (`CUS-00xx`) làm danh tính — hai bên không có ánh xạ.
 * Tìm / sắp / phân trang theo BE `CustomerSearchRepository.search` + `SortWhitelist` + `Pages`.
 */

/** BE `CustomerStatus`. */
export const MOCK_CUSTOMER_STATUSES = [
  "PENDING_ACTIVATION",
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
] as const;
export type MockCustomerStatus = (typeof MOCK_CUSTOMER_STATUSES)[number];

export interface MockCustomer {
  customerId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  taxCode: string | null;
  segmentId: string | null;
  status: MockCustomerStatus;
  version: number;
  createdAt: string;
}

const uuid = (prefix: string, n: number) =>
  `${prefix}${String(n).padStart(4, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Id cố định để test và seed bảng giá trỏ tới. */
export const mockCustomerId = (n: number) => uuid("c0de", n);
/** Nhóm khách (BE `customer-segments`) — chỉ là id, không mock route nhóm khách. */
export const MOCK_SEGMENT_DAI_LY = "5e600000-0000-4000-8000-000000000001";
export const MOCK_SEGMENT_SI = "5e600000-0000-4000-8000-000000000002";

const PREFIXES = ["Công ty TNHH", "Cửa hàng", "Đại lý", "Công ty CP", "Hộ kinh doanh"];
const NAMES = [
  "In Ấn Sài Gòn",
  "Quà Tặng Minh Phát",
  "Đồng Phục Hoàng Gia",
  "Bao Bì Việt",
  "Thời Trang Ánh Dương",
  "Văn Phòng Phẩm Hà Nội",
  "Sự Kiện Phương Nam",
  "Quảng Cáo Sao Mai",
  "Khách Sạn Biển Xanh",
];
const STATUS_CYCLE: readonly MockCustomerStatus[] = [
  "ACTIVE",
  "ACTIVE",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "INACTIVE",
  "ACTIVE",
  "BLOCKED",
];

/** 45 khách cố định: đủ 4 trạng thái, vài khách trùng tên (để thấy thứ tự ổn định), vài trường trống. */
function seed(): MockCustomer[] {
  return Array.from({ length: 45 }, (_, i) => {
    const n = i + 1;
    // Khách 10 và 19 trùng tên khách 1 (cùng `NAMES[0]`, cùng tiền tố) — kiểm tie-break khi sắp theo tên
    const prefix = PREFIXES[i % PREFIXES.length] ?? "";
    const name = NAMES[i % NAMES.length] ?? "";
    const fullName = n === 10 || n === 19 ? `${PREFIXES[0]} ${NAMES[0]}` : `${prefix} ${name}`;
    return {
      customerId: mockCustomerId(n),
      userId: uuid("0e5e", n),
      fullName: n === 1 || n === 10 || n === 19 ? fullName : `${fullName} ${n}`,
      email: `khach${n}@stockflow-demo.vn`,
      phone: n % 5 === 0 ? null : `09${String(10_000_000 + n * 7919).padStart(8, "0")}`,
      taxCode: n % 4 === 0 ? null : `03${String(10_000_000 + n).padStart(8, "0")}`,
      segmentId: n % 3 === 0 ? MOCK_SEGMENT_DAI_LY : n % 3 === 1 ? null : MOCK_SEGMENT_SI,
      status: STATUS_CYCLE[i % STATUS_CYCLE.length] ?? "ACTIVE",
      version: 0,
      createdAt: new Date(Date.UTC(2026, 8, 1) + n * 3_600_000).toISOString(),
    };
  });
}

let customers: MockCustomer[] | null = null;

export function resetCustomerMockStore(): void {
  customers = null;
}

export function allMockCustomers(): readonly MockCustomer[] {
  customers ??= seed();
  return customers;
}

export function findMockCustomer(customerId: string): MockCustomer | null {
  const id = customerId.toLowerCase();
  return allMockCustomers().find((c) => c.customerId === id) ?? null;
}

/** BE `TaxCode.normalise`: bỏ khoảng trắng / dấu chấm; 13 chữ số → 10-3; sai dạng → null (không khớp ai). */
function normaliseTaxCode(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.]/g, "");
  const shaped = /^\d{13}$/.test(compact)
    ? `${compact.slice(0, 10)}-${compact.slice(10)}`
    : compact;
  return /^(\d{10}(-\d{3})?|\d{12})$/.test(shaped) ? shaped : null;
}

/**
 * BE `CustomerSearchRepository.search`: `q` (trim, không phân biệt hoa thường) CHỨA trong họ tên / email /
 * điện thoại, HOẶC khớp ĐÚNG mã số thuế đã chuẩn hoá (không tìm theo một phần mã số thuế).
 */
export function matchesSearch(customer: MockCustomer, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (term === "") return true;
  const contains = [customer.fullName, customer.email, customer.phone].some(
    (field) => field !== null && field.toLowerCase().includes(term),
  );
  const taxCode = normaliseTaxCode(q);
  return contains || (taxCode !== null && customer.taxCode === taxCode);
}

/** BE `CustomerServiceImpl.SORT`: chỉ 4 thuộc tính; mặc định `createdAt` giảm dần. */
export const CUSTOMER_SORT_FIELDS = ["fullName", "email", "createdAt", "status"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];
export interface SortOrder {
  field: CustomerSortField;
  desc: boolean;
}

/**
 * Sắp theo các mệnh đề của `SortWhitelist`. BE không có tie-break (thứ tự các khách bằng nhau tuỳ DB);
 * mock thêm `customerId` tăng dần để kết quả ổn định giữa các lần gọi — chỉ của mock.
 */
export function sortCustomers(rows: readonly MockCustomer[], orders: readonly SortOrder[]) {
  return [...rows].sort((a, b) => {
    for (const { field, desc } of orders) {
      const cmp = a[field].localeCompare(b[field], "vi");
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
  });
}

/** BE `CustomerWebMapper.maskTaxCode`: giữ 3 ký tự đầu / cuối và dấu, ≤ 6 ký tự thì che hết. */
export function maskTaxCode(taxCode: string | null): string | null {
  if (taxCode === null) return null;
  if (taxCode.length <= 6) return "*".repeat(taxCode.length);
  return [...taxCode]
    .map((c, i) => (i < 3 || i >= taxCode.length - 3 || !/[\p{L}\p{N}]/u.test(c) ? c : "*"))
    .join("");
}
