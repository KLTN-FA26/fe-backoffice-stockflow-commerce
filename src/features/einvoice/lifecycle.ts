/**
 * Vòng đời hoá đơn điện tử (docs 21 §5.1; BE `EInvoiceStatus.next()`) và action-gating theo trạng
 * thái + quyền. UI-only — BE kiểm lại mọi thao tác (409 / 403).
 */

import {
  EINVOICE_PERMISSIONS,
  ERROR_NOTICE_PROVIDERS,
  SYSTEM_CORRECTION_BASES,
} from "@/constants/einvoice";

import type { EInvoiceStatusRead } from "@/constants/einvoice";
import type { PermissionCode } from "@/lib/auth";
import type { EInvoice } from "./types";

/**
 * BE `EInvoiceStatus.next()` — VOIDED_DRAFT và REPLACED là trạng thái cuối. `UNKNOWN` (trạng thái BE
 * mới FE chưa biết) không có chuyển tiếp nào: chỉ xem, không thao tác.
 */
export const EINVOICE_TRANSITIONS: Record<EInvoiceStatusRead, readonly EInvoiceStatusRead[]> = {
  DRAFT: ["SUBMITTING", "VOIDED_DRAFT"],
  SUBMITTING: ["ISSUED", "REJECTED"],
  // docs 21 §4.2 bước 7: sửa nguyên nhân rồi phát hành lại — BE mở lại thành nháp trước
  REJECTED: ["DRAFT"],
  // docs 21 BR-03: đã phát hành thì bất biến; chỉ bị thay thế
  ISSUED: ["REPLACED"],
  VOIDED_DRAFT: [],
  REPLACED: [],
  UNKNOWN: [],
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
  | "status"
  | "type"
  | "warnings"
  | "agreementRequired"
  | "adjusted"
  | "hasFiles"
  | "provider"
  | "correctionBasis"
>;

/** Chứng từ hệ thống tự lập (điều chỉnh giảm toàn bộ khi giao bị sửa thành thất bại, WF-05 HĐ-3). */
export const isSystemDrawn = (invoice: Pick<EInvoice, "correctionBasis">): boolean =>
  invoice.correctionBasis != null && SYSTEM_CORRECTION_BASES.includes(invoice.correctionBasis);

/** NCC của hoá đơn gửi được 04/SS-HĐĐT không (BE `sendsErrorNotices`; NCC khác → luôn 409). */
export const sendsErrorNotices = (provider: string | null | undefined): boolean =>
  provider != null && ERROR_NOTICE_PROVIDERS.includes(provider);

/**
 * Nút được phép theo trạng thái (docs 21 §4.2, §4.4, §4.5) và quyền (BR-02: phát hành, tra lại,
 * lập điều chỉnh / thay thế là của Kế toán). Backend phải re-check.
 */
export function allowedEInvoiceActions(
  invoice: Gate,
  can: (permission: PermissionCode) => boolean,
): EInvoiceAction[] {
  const P = EINVOICE_PERMISSIONS;
  const actions: EInvoiceAction[] = [];
  const unknownToProvider = invoice.warnings.includes("UNKNOWN_TO_PROVIDER");
  const systemDrawn = isSystemDrawn(invoice);
  switch (invoice.status) {
    case "DRAFT":
      if (can(P.update)) actions.push("revise", "refreshBuyer");
      // TT 91 Điều 10 khoản 1 điểm b: ERROR bắt buộc; DELIVERY_FAILED nhận văn bản chứng minh (tuỳ chọn)
      if (can(P.update) && (invoice.agreementRequired || systemDrawn))
        actions.push("attachAgreement");
      if (can(P.approve)) actions.push("issue");
      // BE `EInvoice.voidDraft`: nháp hệ thống lập (DELIVERY_FAILED) không huỷ tay — chỉ phát hành
      if (can(P.update) && !systemDrawn) actions.push("void");
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
      // BE HĐ-6: chỉ NCC gửi được mẫu 04/SS-HĐĐT; SePay / Viettel luôn 409 NOT_SUPPORTED
      if (can(P.approve) && sendsErrorNotices(invoice.provider)) actions.push("notifyError");
      break;
    case "REPLACED":
      if (invoice.hasFiles && can(P.read)) actions.push("downloadFiles");
      break;
    case "VOIDED_DRAFT":
    case "UNKNOWN":
      break;
  }
  return actions;
}

export const isTerminalEInvoice = (status: EInvoiceStatusRead) =>
  EINVOICE_TRANSITIONS[status].length === 0;
