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
