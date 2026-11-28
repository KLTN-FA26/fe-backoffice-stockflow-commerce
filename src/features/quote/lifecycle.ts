/**
 * Vòng đời báo giá — chép từ BE `QuoteStatus.canTransitionTo` (origin/develop 438fe6fb) và docs 14 §5:
 *   DRAFT → SENT (gửi) | CANCELLED (huỷ, lý do bắt buộc); sửa nội dung chỉ khi DRAFT
 *   SENT → ACCEPTED | CHANGES_REQUESTED (chỉ khách) ; quá validUntil → EXPIRED (job)
 *   CHANGES_REQUESTED → DRAFT (mở bản sửa, revision + 1)
 *   ACCEPTED → CONVERTED (tạo đơn Nháp) | CANCELLED (chỉ khi là báo giá cũ — QD-16 — có dòng `purchasability` ≠
 *     PURCHASABLE — BE-14 — hoặc khách không còn ACTIVE — LC-2; BE kiểm lại)
 *   EXPIRED / CANCELLED / CONVERTED: trạng thái cuối.
 * 14 BR-10 (sửa ngày 2026-11-26): gửi một nháp có bậc giá thấp hơn giá tham chiếu quá ngưỡng (hoặc không có tham chiếu)
 *   không chuyển SENT — nháp ở lại DRAFT, `priceReviewPending`. Trong lúc chờ: không sửa / gửi; Sales rút lại hoặc huỷ;
 *   Quản lý kinh doanh (`sales-quote-price-approvals:APPROVE`) duyệt (→ SENT) hoặc từ chối (→ nháp sửa được), trừ người
 *   đã gửi duyệt (bốn mắt, BE 403 QUOTE_PRICE_REVIEW_SELF).
 * UI-only — Backend phải re-check (QuoteService, quyền sales-quotes / sales-quote-conversions / sales-quote-price-approvals).
 */

import { QUOTE_PERMISSIONS, QUOTE_PRICE_APPROVAL_PERMISSIONS } from "@/constants";

import type { QuoteApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type StaffQuoteAction =
  | "edit"
  | "send"
  | "cancel"
  | "revise"
  | "convert"
  | "withdrawPriceReview"
  | "approvePrice"
  | "rejectPrice";

/** 14 BR-10: nháp đang chờ duyệt giá, và người đang xem có phải người đã gửi duyệt không. */
export interface QuotePriceReviewState {
  pending: boolean;
  submittedByMe: boolean;
}

/** Nháp chờ duyệt giá: khoá sửa / gửi (BE QUOTE_PRICE_REVIEW_PENDING), còn rút lại, duyệt, từ chối, huỷ. */
const PENDING_REVIEW_ACTIONS: readonly StaffQuoteAction[] = [
  "withdrawPriceReview",
  "approvePrice",
  "rejectPrice",
  "cancel",
];

function permitted(action: StaffQuoteAction, can: (code: PermissionCode) => boolean): boolean {
  if (action === "convert") return can(QUOTE_PERMISSIONS.convert);
  if (action === "approvePrice" || action === "rejectPrice") {
    return can(QUOTE_PRICE_APPROVAL_PERMISSIONS.approve);
  }
  return can(QUOTE_PERMISSIONS.update);
}

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

/**
 * Sửa / gửi / huỷ / mở bản sửa / rút lại yêu cầu duyệt giá cần UPDATE; tạo đơn cần `sales-quote-conversions:CREATE`;
 * duyệt / từ chối giá cần `sales-quote-price-approvals:APPROVE` và không phải người đã gửi duyệt.
 */
export function allowedStaffQuoteActions(
  status: QuoteApiStatus,
  can: (code: PermissionCode) => boolean,
  legacy = false,
  // `canCancelAcceptedQuote` (selectors): báo giá cũ, SKU ngừng bán hoặc khách không còn ACTIVE
  acceptedCancellable = false,
  priceReview: QuotePriceReviewState = { pending: false, submittedByMe: false },
): readonly StaffQuoteAction[] {
  const pending = status === "DRAFT" && priceReview.pending;
  const base = pending ? PENDING_REVIEW_ACTIONS : STAFF_ACTIONS[status];
  return (
    base
      // Báo giá cũ trước rescope: không sửa / gửi / tạo đơn được (BE QUOTE_LINES_LEGACY); đã chấp nhận thì vẫn huỷ được
      // (BE QuoteService.cancel, QD-16).
      .filter((action) => !legacy || (status === "ACCEPTED" && action === "cancel"))
      .filter((action) => !(status === "ACCEPTED" && action === "cancel" && !acceptedCancellable))
      // Bốn mắt (14 BR-10): người gửi duyệt không tự duyệt / từ chối — Backend phải re-check (403 QUOTE_PRICE_REVIEW_SELF)
      .filter(
        (action) =>
          !(priceReview.submittedByMe && (action === "approvePrice" || action === "rejectPrice")),
      )
      .filter((action) => permitted(action, can))
  );
}

/**
 * BR-S12 (KE-HOACH sales-owner, chế độ chặt): việc chỉ người phụ trách khách, người lo thay và Sales Manager làm được trên
 * khách có chủ — lập / sửa / gửi / mở bản sửa / huỷ báo giá và rút yêu cầu duyệt giá. Duyệt giá, tạo đơn từ báo giá khách
 * đã chấp nhận: không đổi (HOP-DONG-API BE-C "Strict checks"). Backend phải re-check (409 CUSTOMER_OWNED_BY_OTHER_SALES).
 */
export const OWNER_GATED_QUOTE_ACTIONS: readonly StaffQuoteAction[] = [
  "edit",
  "send",
  "revise",
  "cancel",
  "withdrawPriceReview",
];

export function isOwnerGatedQuoteAction(action: StaffQuoteAction): boolean {
  return OWNER_GATED_QUOTE_ACTIONS.includes(action);
}

export const TERMINAL_QUOTE_STATUSES: readonly QuoteApiStatus[] = [
  "EXPIRED",
  "CANCELLED",
  "CONVERTED",
];
