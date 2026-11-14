/**
 * Vòng đời hoá đơn điện tử (docs 21 §5.1; BE `EInvoiceStatus.next()`) và action-gating theo trạng
 * thái + quyền. UI-only — BE kiểm lại mọi thao tác (409 / 403).
 */

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";

import type { EInvoiceStatus } from "@/constants/einvoice";
import type { EInvoice } from "./types";

/** BE `EInvoiceStatus.next()` — VOIDED_DRAFT và REPLACED là trạng thái cuối. */
export const EINVOICE_TRANSITIONS: Record<EInvoiceStatus, readonly EInvoiceStatus[]> = {
  DRAFT: ["SUBMITTING", "VOIDED_DRAFT"],
  SUBMITTING: ["ISSUED", "REJECTED"],
  // docs 21 §4.2 bước 7: sửa nguyên nhân rồi phát hành lại — BE mở lại thành nháp trước
  REJECTED: ["DRAFT"],
  // docs 21 BR-03: đã phát hành thì bất biến; chỉ bị thay thế
  ISSUED: ["REPLACED"],
  VOIDED_DRAFT: [],
  REPLACED: [],
};

export type EInvoiceAction =
  | "revise"
  | "refreshBuyer"
  | "issue"
  | "void"
  | "reconcile"
  | "resubmit"
  | "reopen"
  | "attachAgreement"
  | "adjust"
  | "replace"
  | "notifyError"
  | "downloadFiles";

type Gate = Pick<
  EInvoice,
  "status" | "type" | "warnings" | "agreementRequired" | "adjusted" | "hasFiles"
>;

/**
 * Nút được phép theo trạng thái (docs 21 §4.2, §4.4, §4.5) và quyền (BR-02: phát hành, tra lại,
 * lập điều chỉnh / thay thế là của Kế toán). Backend phải re-check.
 */
export function allowedEInvoiceActions(
  invoice: Gate,
  can: (permission: string) => boolean,
): EInvoiceAction[] {
  const P = EINVOICE_PERMISSIONS;
  const actions: EInvoiceAction[] = [];
  const unknownToProvider = invoice.warnings.includes("UNKNOWN_TO_PROVIDER");
  switch (invoice.status) {
    case "DRAFT":
      if (can(P.update)) actions.push("revise", "refreshBuyer");
      if (can(P.update) && invoice.agreementRequired) actions.push("attachAgreement");
      if (can(P.approve)) actions.push("issue");
      if (can(P.update)) actions.push("void");
      break;
    case "SUBMITTING":
      // docs 21 BR-05: chưa xác nhận được kết quả thì không gửi lại — chỉ tra lại;
      // gửi như giao dịch mới chỉ khi NCC báo không biết giao dịch (UNKNOWN_TO_PROVIDER)
      if (can(P.approve)) actions.push("reconcile");
      if (can(P.approve) && unknownToProvider) actions.push("resubmit");
      break;
    case "REJECTED":
      if (can(P.update)) actions.push("reopen");
      break;
    case "ISSUED":
      if (invoice.hasFiles && can(P.read)) actions.push("downloadFiles");
      // docs 21 BR-08: đã điều chỉnh thì không thay thế (BE còn kiểm điều chỉnh / thay thế đang mở)
      if (can(P.create)) actions.push("adjust");
      if (can(P.create) && !invoice.adjusted) actions.push("replace");
      if (can(P.approve)) actions.push("notifyError");
      break;
    case "REPLACED":
      if (invoice.hasFiles && can(P.read)) actions.push("downloadFiles");
      break;
    case "VOIDED_DRAFT":
      break;
  }
  return actions;
}

export const isTerminalEInvoice = (status: EInvoiceStatus) =>
  EINVOICE_TRANSITIONS[status].length === 0;
