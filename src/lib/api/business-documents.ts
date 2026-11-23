/**
 * Đường tải giấy tờ nghiệp vụ của back office (BE `feat/business-documents`; `documents/endpoints.md` mục 1–7). Mọi
 * endpoint là GET trả `application/pdf` + `Content-Disposition` tên tiếng Việt; lỗi vẫn là JSON envelope có `errorCode`.
 */

import {
  BUSINESS_DOCUMENT_LABELS,
  BUSINESS_DOCUMENTS,
} from "@/constants/labels-business-documents";

import { ApiError } from "./error";
import { serverMessageOf } from "./error-message";
import { getFile } from "./file-download";

import type { BusinessDocumentKind } from "@/constants/labels-business-documents";
import type { DownloadedFile } from "./file-download";

const seg = encodeURIComponent;

/** Đường của từng giấy tờ (không gồm `/api/v1` — `api` client đã gắn). */
export const BUSINESS_DOCUMENT_PATHS = {
  contractAppendix: (orderId: string) => `/orders/${seg(orderId)}/contract/appendix`,
  contractLiquidation: (orderId: string) => `/orders/${seg(orderId)}/contract/liquidation`,
  returnReceiptVoucher: (receiptId: string) => `/goods-receipts/returns/${seg(receiptId)}/voucher`,
  refundConfirmation: (recordId: string) => `/refunds/records/${seg(recordId)}/confirmation`,
  paymentConfirmation: (installmentId: string, receiptId: string) =>
    `/installments/${seg(installmentId)}/receipts/${seg(receiptId)}/confirmation`,
  /** `from` / `to`: `YYYY-MM-DD`. */
  debtReconciliation: (customerId: string, from: string, to: string) =>
    `/installments/debt-reconciliation?${new URLSearchParams({ customerId, from, to }).toString()}`,
  einvoiceAgreementDraft: (correctionId: string) =>
    `/einvoices/${seg(correctionId)}/agreement/draft`,
} as const;

/** GET giấy tờ thành file; tên lấy từ `Content-Disposition` (`filename*` UTF-8). */
export function downloadBusinessDocument(
  kind: BusinessDocumentKind,
  path: string,
  signal?: AbortSignal,
): Promise<DownloadedFile> {
  return getFile(path, BUSINESS_DOCUMENTS[kind].fallbackName, signal);
}

/**
 * Lỗi tải giấy tờ → câu tiếng Việt: mã riêng của endpoint (bảng `BUSINESS_DOCUMENTS[kind].errors`) trước, rồi 403 / 404
 * chung, rồi câu tiếng Việt BE kèm (mã BE thêm sau), cuối cùng câu dự phòng.
 */
export function businessDocumentErrorMessage(kind: BusinessDocumentKind, error: unknown): string {
  const spec = BUSINESS_DOCUMENTS[kind];
  const L = BUSINESS_DOCUMENT_LABELS;
  if (!(error instanceof ApiError)) return L.generic(spec.noun);
  const own = spec.errors[error.code];
  if (own) return own;
  if (error.status === 403) return L.forbidden(spec.noun);
  if (error.status === 404) return L.notFound(spec.noun);
  return serverMessageOf(error) ?? L.generic(spec.noun);
}
