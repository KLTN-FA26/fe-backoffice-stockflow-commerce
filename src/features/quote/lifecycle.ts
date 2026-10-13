/**
 * Vòng đời báo giá — chép từ BE `QuoteStatus.canTransitionTo` (d215f6e, handoff SCRUM-448):
 *   DRAFT → SENT (gửi) | CANCELLED (huỷ, lý do bắt buộc) ; sửa nội dung chỉ khi DRAFT
 *   SENT → ACCEPTED | CHANGES_REQUESTED (chỉ khách portal) ; quá validUntil → EXPIRED
 *   CHANGES_REQUESTED → DRAFT (mở bản sửa, revision + 1)
 *   ACCEPTED → CONVERTED (tạo đơn bán)
 *   EXPIRED / CANCELLED / CONVERTED: trạng thái cuối, không thao tác.
 * UI-only — Backend phải re-check (QuoteService: back-office vs portal, quyền sales-quotes).
 */

import { QUOTE_PERMISSIONS } from "@/constants";

import type { QuoteApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type StaffQuoteAction = "edit" | "send" | "cancel" | "revise" | "convert";
export type PortalQuoteAction = "accept" | "requestChanges";

export const QUOTE_TRANSITIONS: Readonly<Record<QuoteApiStatus, readonly QuoteApiStatus[]>> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "CHANGES_REQUESTED", "EXPIRED"],
  CHANGES_REQUESTED: ["DRAFT"],
  ACCEPTED: ["CONVERTED"],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED: [],
};

const STAFF_ACTIONS: Readonly<Record<QuoteApiStatus, readonly StaffQuoteAction[]>> = {
  DRAFT: ["edit", "send", "cancel"],
  SENT: [],
  CHANGES_REQUESTED: ["revise"],
  ACCEPTED: ["convert"],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED: [],
};

/** Nút back-office: mọi thao tác đổi báo giá cần `sales-quotes:UPDATE` (tạo mới cần CREATE). */
export function allowedStaffQuoteActions(
  status: QuoteApiStatus,
  can: (code: PermissionCode) => boolean,
): readonly StaffQuoteAction[] {
  return can(QUOTE_PERMISSIONS.update) ? STAFF_ACTIONS[status] : [];
}

/**
 * Nút portal: chỉ khi SENT và còn hiệu lực; cần `sales-quotes:APPROVE` (BE chỉ nhận từ tài khoản
 * khách — nhân viên có APPROVE vẫn bị 403).
 */
export function allowedPortalQuoteActions(
  status: QuoteApiStatus,
  validUntil: string,
  can: (code: PermissionCode) => boolean,
  now = Date.now(),
): readonly PortalQuoteAction[] {
  if (status !== "SENT" || new Date(validUntil).getTime() <= now) return [];
  return can(QUOTE_PERMISSIONS.approve) ? ["accept", "requestChanges"] : [];
}

export const TERMINAL_QUOTE_STATUSES: readonly QuoteApiStatus[] = [
  "EXPIRED",
  "CANCELLED",
  "CONVERTED",
];
