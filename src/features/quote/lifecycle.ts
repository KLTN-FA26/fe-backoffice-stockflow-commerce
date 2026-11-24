/**
 * Vòng đời báo giá — chép từ BE `QuoteStatus.canTransitionTo` (origin/develop 438fe6fb) và docs 14 §5:
 *   DRAFT → SENT (gửi) | CANCELLED (huỷ, lý do bắt buộc); sửa nội dung chỉ khi DRAFT
 *   SENT → ACCEPTED | CHANGES_REQUESTED (chỉ khách) ; quá validUntil → EXPIRED (job)
 *   CHANGES_REQUESTED → DRAFT (mở bản sửa, revision + 1)
 *   ACCEPTED → CONVERTED (tạo đơn Nháp) | CANCELLED (chỉ khi có dòng `purchasability` ≠ PURCHASABLE — BE-14 — hoặc
 *     khách không còn ACTIVE — LC-2; BE kiểm lại)
 *   EXPIRED / CANCELLED / CONVERTED: trạng thái cuối.
 * UI-only — Backend phải re-check (QuoteService, quyền sales-quotes / sales-quote-conversions).
 */

import { QUOTE_PERMISSIONS } from "@/constants";

import type { QuoteApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type StaffQuoteAction = "edit" | "send" | "cancel" | "revise" | "convert";

export const QUOTE_TRANSITIONS: Readonly<Record<QuoteApiStatus, readonly QuoteApiStatus[]>> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "CHANGES_REQUESTED", "EXPIRED"],
  CHANGES_REQUESTED: ["DRAFT"],
  ACCEPTED: ["CONVERTED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED: [],
};

const STAFF_ACTIONS: Readonly<Record<QuoteApiStatus, readonly StaffQuoteAction[]>> = {
  DRAFT: ["edit", "send", "cancel"],
  // Chờ khách: không có nút đổi nội dung (plan A4).
  SENT: [],
  CHANGES_REQUESTED: ["revise"],
  ACCEPTED: ["cancel", "convert"],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED: [],
};

/** Sửa / gửi / huỷ / mở bản sửa cần UPDATE; tạo đơn cần `sales-quote-conversions:CREATE`. */
export function allowedStaffQuoteActions(
  status: QuoteApiStatus,
  can: (code: PermissionCode) => boolean,
  legacy = false,
  // `canCancelAcceptedQuote` (selectors): SKU ngừng bán hoặc khách không còn ACTIVE
  acceptedCancellable = false,
): readonly StaffQuoteAction[] {
  // Báo giá cũ trước rescope chỉ xem (BE QUOTE_LINES_LEGACY).
  if (legacy) return [];
  return STAFF_ACTIONS[status]
    .filter((action) => !(status === "ACCEPTED" && action === "cancel" && !acceptedCancellable))
    .filter((action) =>
      action === "convert" ? can(QUOTE_PERMISSIONS.convert) : can(QUOTE_PERMISSIONS.update),
    );
}

export const TERMINAL_QUOTE_STATUSES: readonly QuoteApiStatus[] = [
  "EXPIRED",
  "CANCELLED",
  "CONVERTED",
];
