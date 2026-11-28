/**
 * Sale phụ trách khách (kế hoạch sales-owner 2026-11-27, bản chặt đã duyệt 28/11; hợp đồng API `HOP-DONG-API.md`). Tên
 * enum, mã quyền, mã lỗi chép nguyên văn từ hợp đồng — BE và FE làm song song. File riêng, import thẳng
 * `@/constants/sales-owner`.
 */

/* ── Mã quyền (hợp đồng §Permissions; BE kiểm lại từng request) ── */

/** Xem / giao, đổi, chuyển hàng loạt, trả lô tạm (BR-S01: chỉ Sales Manager và System Admin có UPDATE). */
export const SALES_OWNER_PERMISSIONS = {
  read: "customer-sales-owners:READ",
  update: "customer-sales-owners:UPDATE",
} as const;

/** Lịch người thay (BR-S07): Sale lập / huỷ cho chính mình, quản lý cho mọi người — BE kiểm trong service. */
export const STAFF_COVER_PERMISSIONS = {
  read: "staff-covers:READ",
  create: "staff-covers:CREATE",
  update: "staff-covers:UPDATE",
} as const;

/** Khách tiềm năng (§10.3): Sale đọc / liên hệ / chuyển lead của mình; quản lý giao, loại. */
export const SALES_LEAD_PERMISSIONS = {
  read: "sales-leads:READ",
  update: "sales-leads:UPDATE",
} as const;

/** Bảng tải của Sales Manager (§10.4) — chỉ SALES_MANAGER, SYSTEM_ADMIN. */
export const SALES_WORKLOAD_PERMISSIONS = {
  read: "sales-workload:READ",
} as const;

/** Yêu cầu đổi Sale của khách (§10.5): khách tạo; quản lý xem và quyết. */
export const OWNER_CHANGE_REQUEST_PERMISSIONS = {
  read: "sales-owner-change-requests:READ",
  approve: "sales-owner-change-requests:APPROVE",
} as const;

/* ── Mã lỗi (hợp đồng §Error codes, bundle en/vi) dùng để rẽ nhánh trên FE ── */

export const SALES_OWNER_ERROR_CODES = {
  /** 409: Sale khác chủ động làm việc trên khách có chủ (BR-S12); `details.salesOwnerName` nêu tên người phụ trách. */
  ownedByOther: "CUSTOMER_OWNED_BY_OTHER_SALES",
  /** 409: "Nhận" hội thoại của khách đã có chủ (BR-S05, tình huống 18); `details.salesOwnerName` như trên. */
  claimOnly: "CUSTOMER_UNASSIGNED_CLAIM_ONLY",
  /** 400: thiếu mã số thuế khi tạo khách (BR-S14). */
  taxCodeRequired: "CUSTOMER_TAX_CODE_REQUIRED",
  /** 409: cùng `requestId` mà nội dung lô chuyển khác lần trước → phải sinh khoá mới (BR-S09). */
  transferRequestReused: "SALES_OWNER_TRANSFER_REQUEST_REUSED",
  /** 422: một lô chuyển quá `SALES_OWNER_LIMITS.transferMax` khách, dù chọn tên hay cả sổ (BR-S09). */
  transferTooLarge: "SALES_OWNER_TRANSFER_TOO_LARGE",
} as const;

/* ── Đường dẫn API (hợp đồng §Endpoints) ── */

export const SALES_OWNER_API = {
  owner: (customerId: string) => `/customers/${encodeURIComponent(customerId)}/sales-owner`,
  history: (customerId: string) =>
    `/customers/${encodeURIComponent(customerId)}/sales-owner-history`,
  duplicates: "/customers/duplicates",
  /**
   * D42: Sale giao được làm người phụ trách / người thay — chỉ SALES_STAFF đang làm (`customer-sales-owners:READ` hoặc
   * `staff-covers:READ`). Mọi ô chọn người phụ trách, người thay, người nhận lead dùng nguồn này.
   */
  salesAgents: "/customers/sales-agents",
  workload: "/sales/workload",
  handoverSummary: (userId: string) =>
    `/identity/users/${encodeURIComponent(userId)}/handover-summary`,
  chatWorkload: "/chat/agents/workload",
  /** Nguồn dự phòng của ô chọn Sale khi BE chưa có `salesAgents` (gồm cả quản lý / admin — FE lọc bớt). */
  chatAgents: "/chat/agents",
  chatStaff: "/chat/staff",
} as const;

/* ── Enum (hợp đồng §Enums, lưu STRING có CHECK ở DB) ── */

export const SALES_OWNER_STATES = ["ASSIGNED", "NEEDS_ASSIGNMENT", "UNASSIGNED"] as const;
export type SalesOwnerState = (typeof SALES_OWNER_STATES)[number];

export const SALES_OWNER_CHANGE_REASONS = [
  "CREATED_BY_SALES",
  "LEAD_CONVERTED",
  "CLAIMED_FROM_QUEUE",
  "STAFF_LEFT",
  "WORKLOAD",
  "CUSTOMER_REQUEST",
  "REGION",
  "TEMPORARY_LEAVE",
  "RETURN_FROM_LEAVE",
  "BACKFILL",
  "OTHER",
] as const;
export type SalesOwnerChangeReason = (typeof SALES_OWNER_CHANGE_REASONS)[number];

/** BR-S03: lý do người quản lý chọn khi đổi một khách (các lý do còn lại do hệ thống tự ghi). */
export const MANUAL_CHANGE_REASONS = [
  "STAFF_LEFT",
  "WORKLOAD",
  "CUSTOMER_REQUEST",
  "REGION",
  "OTHER",
] as const satisfies readonly SalesOwnerChangeReason[];

/** BR-S09, §10.1: lý do của một lô chuyển khách (khách yêu cầu là việc của từng khách, không theo lô). */
export const TRANSFER_REASONS = [
  "STAFF_LEFT",
  "TEMPORARY_LEAVE",
  "WORKLOAD",
  "REGION",
  "OTHER",
] as const satisfies readonly SalesOwnerChangeReason[];

export const LEAD_STATUSES = ["NEW", "ASSIGNED", "CONTACTED", "CONVERTED", "DISQUALIFIED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Một dòng lịch sử lead (`GET /leads/{id}/history`): `CHANGE` đổi trạng thái / Sale; `RESUBMITTED` cùng doanh nghiệp gửi
 * lại form trong 24 giờ — lead không đổi, nội dung form mới ở `note` (§10.7).
 */
export const LEAD_HISTORY_KINDS = ["CHANGE", "RESUBMITTED"] as const;
export type LeadHistoryKind = (typeof LEAD_HISTORY_KINDS)[number];

export const OWNER_CHANGE_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type OwnerChangeRequestStatus = (typeof OWNER_CHANGE_REQUEST_STATUSES)[number];

export const OWNER_CHANGE_REQUEST_REASONS = [
  "SLOW_RESPONSE",
  "NOT_SATISFIED",
  "PREFER_KNOWN_CONTACT",
  "OTHER",
] as const;

/* ── Giới hạn ── */

export const SALES_OWNER_LIMITS = {
  /** BR-S07 / D7: lịch người thay tối đa 60 ngày (BE `STAFF_COVER_TOO_LONG`). */
  coverMaxDays: 60,
  /** Ô chữ (ghi chú, lý do): BE chưa công bố giới hạn — giữ ngang các màn khác (1000). */
  textMax: 1000,
  /** Sức chứa khách mới mỗi tháng (D13): số nguyên ≥ 0; trống = không giới hạn. */
  capacityMax: 999,
  /** BR-S09: một lô chuyển tối đa 500 khách, chọn tên hay cả sổ (BE `SALES_OWNER_TRANSFER_TOO_LARGE`). */
  transferMax: 500,
} as const;

/* ── Route ── */

const SALES_BASE = "/admin/sales";

export const SALES_ROUTES = {
  assignment: `${SALES_BASE}/assignment`,
  covers: `${SALES_BASE}/covers`,
  leads: `${SALES_BASE}/leads`,
  ownerChangeRequests: `${SALES_BASE}/owner-change-requests`,
} as const;

/**
 * "Chuyển thành khách" (§10.7): mở form tạo khách với thông tin của lead. Tên tham số trùng tên ô của form tạo khách
 * (`customerCreateInputSchema`) + `leadId` — form tạo khách (BO-2) đọc chúng và gửi `leadId` cho `POST /customers`.
 */
export const CUSTOMER_FROM_LEAD_PARAMS = [
  "leadId",
  "companyName",
  "taxCode",
  "contactName",
  "email",
  "phone",
] as const;

export function customerCreateFromLead(
  values: Partial<Record<(typeof CUSTOMER_FROM_LEAD_PARAMS)[number], string | null | undefined>>,
): string {
  const query = new URLSearchParams();
  for (const key of CUSTOMER_FROM_LEAD_PARAMS) {
    const value = values[key]?.trim();
    if (value) query.set(key, value);
  }
  return `/admin/customers/create?${query.toString()}`;
}

export const SALES_OWNER_STORAGE_KEYS = {
  leadsConfig: "stockflow:admin:sales:leads:config",
  requestsConfig: "stockflow:admin:sales:owner-change-requests:config",
  coversConfig: "stockflow:admin:sales:covers:config",
  needsAssignmentConfig: "stockflow:admin:sales:needs-assignment:config",
} as const;
