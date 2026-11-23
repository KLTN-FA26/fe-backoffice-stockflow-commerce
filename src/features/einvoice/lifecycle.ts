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
import type { EInvoice, EInvoiceListItem } from "./types";

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
  | "voidUnsendable"
  | "reconcile"
  | "resubmit"
  | "withdraw"
  | "recordPortalResult"
  | "reopen"
  | "attachAgreement"
  | "adjust"
  | "replace"
  | "reduceFailedDelivery"
  | "recordExternalReduction"
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
  | "grandTotal"
> &
  Partial<Pick<EInvoice, "reversedAt" | "errorNoticeSupported" | "deliveryFailedAt">>;

/** Một điều chỉnh / thay thế của hoá đơn (BE `GET /einvoices/{id}/corrections`). */
export type CorrectionRow = Pick<
  EInvoiceListItem,
  "type" | "status" | "grandTotal" | "correctionBasis"
>;

/** Chứng từ hệ thống tự lập (điều chỉnh giảm toàn bộ khi giao bị sửa thành thất bại, WF-05 HĐ-3). */
export const isSystemDrawn = (invoice: Pick<EInvoice, "correctionBasis">): boolean =>
  invoice.correctionBasis != null && SYSTEM_CORRECTION_BASES.includes(invoice.correctionBasis);

/**
 * NCC của hoá đơn gửi được 04/SS-HĐĐT không: cờ BE `errorNoticeSupported` (WF-05 F-11); BE cũ chưa gửi cờ → bảng dự
 * phòng `ERROR_NOTICE_PROVIDERS`. NCC khác → BE luôn 409.
 */
export const sendsErrorNotices = (
  invoice: Partial<Pick<EInvoice, "provider" | "errorNoticeSupported">>,
): boolean =>
  invoice.errorNoticeSupported ??
  (invoice.provider != null && ERROR_NOTICE_PROVIDERS.includes(invoice.provider));

const live = (row: CorrectionRow) => row.status !== "VOIDED_DRAFT";

/**
 * Tổng có thuế còn hiệu lực của hoá đơn: chính nó cộng các điều chỉnh ĐÃ phát hành (điều chỉnh giảm mang số âm).
 * ≤ 0 = đã giảm hết — BE từ chối điều chỉnh / thay thế (BO-03).
 */
export function netTotal(
  invoice: Pick<EInvoice, "grandTotal">,
  corrections: readonly CorrectionRow[],
): number {
  return corrections
    .filter((row) => row.type === "ADJUSTMENT" && row.status === "ISSUED")
    .reduce((sum, row) => sum + row.grandTotal, invoice.grandTotal);
}

/**
 * Nút được phép theo trạng thái (docs 21 §4.2, §4.4, §4.5) và quyền (BR-02: phát hành, kiểm tra lại,
 * lập điều chỉnh / thay thế là của Kế toán). Backend phải re-check.
 *
 * `corrections` = điều chỉnh / thay thế của hoá đơn (cả bản đã huỷ); `undefined` = chưa tải → ẩn mọi thao tác chỉnh
 * trên hoá đơn đã phát hành cho tới khi biết (không hiện nút BE sẽ từ chối).
 */
export function allowedEInvoiceActions(
  invoice: Gate,
  can: (permission: PermissionCode) => boolean,
  corrections?: readonly CorrectionRow[],
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
      // BE `EInvoice.voidDraft`: nháp hệ thống lập (DELIVERY_FAILED) không huỷ thường — chỉ huỷ với mã
      // UNSENDABLE_REVERSAL khi không gửi được qua NCC (WF-05 Q-8, F-14; BE quyết: 409 EINVOICE_REVERSAL_STILL_SENDABLE)
      if (can(P.update)) actions.push(systemDrawn ? "voidUnsendable" : "void");
      break;
    case "SUBMITTING":
      // docs 21 BR-05: chưa xác nhận được kết quả thì không gửi lại — chỉ kiểm tra lại;
      // gửi như giao dịch mới chỉ khi NCC báo không biết giao dịch (UNKNOWN_TO_PROVIDER)
      if (can(P.approve)) actions.push("reconcile");
      if (can(P.approve) && unknownToProvider) actions.push("resubmit");
      // BE HĐ-1 / WF-05 Q-5: rút về REJECTED để phát hành lại. Câu trả lời của NCC và mốc thời gian do BE quyết lúc rút
      // (409 EINVOICE_WITHDRAWAL_REFUSED + details) — FE không tự tính đồng hồ, không tự đoán "đã phát hành chưa có số".
      if (can(P.approve) && invoice.provider) actions.push("withdraw");
      // WF-05 Q-8 (F-13): hoá đơn kẹt "đang gửi" không lối ra — Kế toán ghi kết quả đã kiểm trên cổng NCC
      if (can(P.approve) && invoice.provider) actions.push("recordPortalResult");
      break;
    case "REJECTED":
      if (can(P.update)) actions.push("reopen");
      break;
    case "ISSUED":
      if (invoice.hasFiles && can(P.read)) actions.push("downloadFiles");
      if (corrections) actions.push(...correctionActions(invoice, can, corrections));
      // BE HĐ-6: chỉ NCC gửi được mẫu 04/SS-HĐĐT; SePay / Viettel luôn 409 NOT_SUPPORTED
      if (can(P.approve) && sendsErrorNotices(invoice)) actions.push("notifyError");
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

/**
 * Điều chỉnh / thay thế / giảm của hoá đơn đã phát hành (WF-05 BO-03, C-17; Q-8, Q-9; BE-11) — chỉ hiện chỗ BE nhận:
 * - hoá đơn điều chỉnh: không điều chỉnh / thay thế tiếp (BE từ chối);
 * - đã giảm hết (`reversedAt`, hoặc tổng còn hiệu lực ≤ 0): không còn gì để chỉnh (EINVOICE_NOT_IN_FORCE);
 * - hoá đơn thay thế: KHÔNG điều chỉnh (Q-9, TT 91 Điều 10 khoản 6a — sai sót thì "Thay thế" tiếp; trả hàng / giao
 *   thất bại thì Kế toán làm trên cổng NCC rồi ghi lại);
 * - đã có thay thế chưa huỷ: không điều chỉnh (BR-08, EINVOICE_CORRECTION_FORM_FIXED);
 * - đã điều chỉnh, hoặc còn điều chỉnh / thay thế chưa huỷ (kể cả nháp DELIVERY_FAILED / RETURN của hệ thống): không
 *   thay thế (BR-08).
 */
function correctionActions(
  invoice: Gate,
  can: (permission: PermissionCode) => boolean,
  corrections: readonly CorrectionRow[],
): EInvoiceAction[] {
  const P = EINVOICE_PERMISSIONS;
  const actions: EInvoiceAction[] = [];
  const known = invoice.type === "ORIGINAL" || invoice.type === "REPLACEMENT";
  const inForce = known && !invoice.reversedAt && netTotal(invoice, corrections) > 0;
  const liveRows = corrections.filter(live);
  const liveReplacement = liveRows.some((row) => row.type === "REPLACEMENT");
  const liveReduction = liveRows.some((row) => row.correctionBasis === "DELIVERY_FAILED");
  if (inForce && can(P.create)) {
    if (invoice.type !== "REPLACEMENT" && !liveReplacement) actions.push("adjust");
    if (!invoice.adjusted && liveRows.length === 0) actions.push("replace");
  }
  // BE-11 (F-15): lần giao bị sửa thành thất bại mà hoá đơn gốc còn hiệu lực chưa được giảm (vd đã có điều chỉnh từ
  // trước) — BE lập bản giảm phần còn lại; 409 EINVOICE_REVERSAL_NOT_APPLICABLE nếu chuyến đã giao lại / đã giảm.
  // Hoá đơn thay thế không có nút này: Q-9 — giao thất bại trên hoá đơn thay thế đi đường cổng NCC (dưới).
  if (
    inForce &&
    can(P.create) &&
    invoice.type === "ORIGINAL" &&
    invoice.deliveryFailedAt &&
    !liveReduction
  )
    actions.push("reduceFailedDelivery");
  // Q-8 / Q-9 (F-13): bản giảm không gửi được qua NCC đã bị huỷ (UNSENDABLE_REVERSAL), hoặc hoá đơn thay thế cần giảm
  // (trả hàng / giao thất bại) — Kế toán làm trên cổng NCC rồi ghi số và tệp vào đây. BE kiểm lại
  // (409 EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE).
  // Bản giảm DELIVERY_FAILED bị huỷ còn có lý do thứ hai: lần giao được sửa lại thành "đã giao" (BE-29,
  // DELIVERY_CORRECTED_BACK) — khi đó BE gỡ `reversedAt` của hoá đơn gốc. Chỉ khi hoá đơn gốc VẪN đã giảm toàn bộ
  // (`reversedAt`) thì bản bị huỷ là bản "không gửi được" (BE V20261219000300).
  const voidedReduction =
    !!invoice.reversedAt &&
    corrections.some(
      (row) => row.correctionBasis === "DELIVERY_FAILED" && row.status === "VOIDED_DRAFT",
    );
  const replacementToReduce = invoice.type === "REPLACEMENT" && inForce;
  if (can(P.approve) && ((voidedReduction && !liveReduction) || replacementToReduce))
    actions.push("recordExternalReduction");
  return actions;
}

/**
 * Bản nháp "Biên bản thoả thuận điều chỉnh / thay thế hoá đơn" (BE `feat/business-documents` #7,
 * `GET /einvoices/{id}/agreement/draft`): chỉ trên chính bản điều chỉnh / thay thế, trừ nháp đã huỷ (BE 409
 * `EINVOICE_CORRECTION_NOT_APPLICABLE` với hoá đơn gốc / nháp đã huỷ). In, ký, rồi tải bản scan qua "Đính kèm biên bản".
 * Quyền `einvoices:READ` do nút kiểm.
 */
export function agreementDraftAvailable(invoice: Pick<EInvoice, "type" | "status">): boolean {
  return (
    (invoice.type === "ADJUSTMENT" || invoice.type === "REPLACEMENT") &&
    invoice.status !== "VOIDED_DRAFT"
  );
}

export const isTerminalEInvoice = (status: EInvoiceStatusRead) =>
  EINVOICE_TRANSITIONS[status].length === 0;
