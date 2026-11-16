/**
 * Mutations hoá đơn điện tử + invalidation map (docs 21). Hoá đơn không đổi thanh toán / trạng thái
 * đơn (BR-11) nhưng hoàn tất đơn chờ mọi lần giao có hoá đơn đã phát hành (BE `OrderSettlementService`,
 * WF-05 plan §4) → làm mới cả root `orders`.
 */

import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  adjustEInvoice,
  attachAgreement,
  drawUpEInvoice,
  issueEInvoice,
  reconcileEInvoice,
  recordErrorNotice,
  refreshBuyer,
  reopenEInvoice,
  replaceEInvoice,
  resubmitEInvoice,
  reviseDraft,
  sendErrorNotice,
  voidDraft,
} from "./api";
import { EINVOICE_STALE_CODES } from "./errors";
import { einvoiceKeys, einvoiceSettingsKeys } from "./queries";
import {
  activateProvider,
  changeAutoIssue,
  selectSeries,
  storeProviderAccount,
} from "./settings-api";

const INVOICE_INVALIDATION = [einvoiceKeys.all, QUERY_ROOTS.orders] as const;

function einvoiceMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
  invalidate: readonly (readonly string[])[] = INVOICE_INVALIDATION,
) {
  return withStaleRefetch(
    createMutation<TInput, TResult>(fn, { invalidate, successMessage, showErrorToast: false }),
    invalidate,
    EINVOICE_STALE_CODES,
  );
}

export const useDrawUpEInvoice = einvoiceMutation(drawUpEInvoice, "Đã lập hoá đơn nháp.");
export const useReviseDraft = einvoiceMutation(reviseDraft, "Đã lưu hoá đơn nháp.");
export const useRefreshBuyer = einvoiceMutation(refreshBuyer, "Đã làm mới thông tin bên mua.");
export const useVoidDraft = einvoiceMutation(voidDraft, "Đã huỷ hoá đơn nháp.");
export const useIssueEInvoice = einvoiceMutation(
  issueEInvoice,
  "Đã gửi phát hành. Đang chờ kết quả từ nhà cung cấp.",
);
export const useReconcileEInvoice = einvoiceMutation(reconcileEInvoice, "Đã tra lại kết quả.");
export const useReopenEInvoice = einvoiceMutation(reopenEInvoice, "Đã mở lại thành nháp.");
export const useResubmitEInvoice = einvoiceMutation(
  resubmitEInvoice,
  "Đã gửi lại như giao dịch mới.",
);
export const useAdjustEInvoice = einvoiceMutation(adjustEInvoice, "Đã lập nháp điều chỉnh.");
export const useReplaceEInvoice = einvoiceMutation(replaceEInvoice, "Đã lập nháp thay thế.");
export const useAttachAgreement = einvoiceMutation(attachAgreement, "Đã gắn văn bản thoả thuận.");
export const useRecordErrorNotice = einvoiceMutation(
  recordErrorNotice,
  "Đã lập thông báo sai sót.",
);
export const useSendErrorNotice = einvoiceMutation(sendErrorNotice, "Đã gửi thông báo sai sót.");

const SETTINGS_INVALIDATION = [einvoiceSettingsKeys.all] as const;
export const useChangeAutoIssue = einvoiceMutation(
  changeAutoIssue,
  "Đã lưu cấu hình phát hành.",
  SETTINGS_INVALIDATION,
);
export const useStoreProviderAccount = einvoiceMutation(
  storeProviderAccount,
  "Đã lưu tài khoản nhà cung cấp.",
  SETTINGS_INVALIDATION,
);
export const useSelectSeries = einvoiceMutation(
  selectSeries,
  "Đã lưu ký hiệu hoá đơn.",
  SETTINGS_INVALIDATION,
);
export const useActivateProvider = einvoiceMutation(
  activateProvider,
  "Đã chuyển nhà cung cấp phát hành.",
  SETTINGS_INVALIDATION,
);
