/**
 * Đề nghị cấp hạn mức — vòng đời + action-gating (kltn-docs 15 §4.3 bước 9–11a; BE `CreditRequestStatus`,
 * `CreditRequest`):
 *   khách gửi → SUBMITTED ─(Sale ghi ý kiến)→ PENDING_APPROVAL → APPROVED / REJECTED
 *   Sale gửi thay khách (kèm ý kiến) → PENDING_APPROVAL
 *   SUBMITTED / PENDING_APPROVAL ─(người gửi rút)→ WITHDRAWN
 * UI-only — Backend phải re-check (quyền customer-credit-requests UPDATE / APPROVE / CREATE; người quyết khác người
 * gửi / người ghi ý kiến — CREDIT_REQUEST_SELF_DECISION; chỉ người gửi rút — CREDIT_REQUEST_NOT_FILER).
 */

import { CREDIT_REQUEST_PERMISSIONS } from "@/constants/credit-request";

import type { PermissionCode } from "@/lib/auth";
import type { CreditRequest, CreditRequestStatus } from "./types";

export const CREDIT_REQUEST_TRANSITIONS = {
  SUBMITTED: ["PENDING_APPROVAL", "WITHDRAWN"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "WITHDRAWN"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
  UNKNOWN: [],
} as const satisfies Record<CreditRequestStatus, readonly CreditRequestStatus[]>;

export type CreditRequestAction = "recommend" | "approve" | "reject" | "withdraw" | "attach";

export function isCreditRequestOpen(status: CreditRequestStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_APPROVAL";
}

export function allowedCreditRequestActions(
  request: Pick<CreditRequest, "status" | "source" | "submittedBy" | "recommendedBy">,
  can: (code: PermissionCode) => boolean,
  userId: string | null,
): CreditRequestAction[] {
  const actions: CreditRequestAction[] = [];
  const open = isCreditRequestOpen(request.status);
  const involved = !!userId && (userId === request.submittedBy || userId === request.recommendedBy);
  if (request.status === "SUBMITTED" && can(CREDIT_REQUEST_PERMISSIONS.update))
    actions.push("recommend");
  // BE CREDIT_REQUEST_SELF_DECISION: người gửi / người ghi ý kiến không tự quyết → ẩn nút thay vì để 409
  if (request.status === "PENDING_APPROVAL" && can(CREDIT_REQUEST_PERMISSIONS.approve) && !involved)
    actions.push("approve", "reject");
  // BE `CreditRequest.withdrawByStaff`: chỉ đề nghị Sale gửi thay khách (`SALES`), đúng người đã gửi
  const filedByMe = request.source === "SALES" && !!userId && userId === request.submittedBy;
  if (open && filedByMe && can(CREDIT_REQUEST_PERMISSIONS.create)) actions.push("withdraw");
  if (open && can(CREDIT_REQUEST_PERMISSIONS.create)) actions.push("attach");
  return actions;
}
