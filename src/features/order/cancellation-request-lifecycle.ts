/**
 * Yêu cầu huỷ của khách — vòng đời (docs 17 §5.4) + gate thao tác theo trạng thái và mã quyền.
 *
 * `Pending` → `Approved` (Sale duyệt, đơn bị huỷ) | `Rejected` (Sale từ chối kèm lý do) | `Expired` (hệ thống: đơn đã tới mức
 * không huỷ được hoặc đã huỷ theo đường khác). Ba trạng thái sau là cuối. Mã BE: PENDING / APPROVED / REJECTED / EXPIRED.
 * UI-only — Backend phải re-check (ORDER_CANCELLATION_REQUEST_NOT_PENDING, ORDER_NOT_CANCELLABLE).
 */

import { ORDER_PERMISSIONS } from "@/constants";
import { CANCELLATION_REQUEST_STATUSES } from "@/constants/statuses";

import type { PermissionCode } from "@/lib/auth";

export type CancellationRequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number];

/** docs 17 §5.4 "Chuyển tiếp cho phép". Terminal = rỗng. */
export const CANCELLATION_REQUEST_TRANSITIONS: Readonly<
  Record<CancellationRequestStatus, readonly CancellationRequestStatus[]>
> = {
  PENDING: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
};

export type CancellationRequestActionCode = "approve" | "reject";

/**
 * Thao tác của một yêu cầu: chỉ khi còn `PENDING` (trạng thái BE lạ → không đoán, không mở nút) và người dùng có
 * `sales-order-cancellations:UPDATE` (docs 17 §2: Sale duyệt / từ chối). Hai thao tác cùng mã quyền (BE
 * `CancellationRequestController`).
 */
export function allowedCancellationRequestActions(
  status: string,
  can: (code: PermissionCode) => boolean,
): CancellationRequestActionCode[] {
  if (status !== "PENDING" || !can(ORDER_PERMISSIONS.cancel)) return [];
  return ["approve", "reject"];
}
