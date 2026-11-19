/**
 * Mutations trả hàng + invalidation map (docs 17 §4.10, 15 §4.5, 03 §4.2). Yêu cầu trả hàng đổi trạng thái đơn
 * (`Return Requested` → `Returned` → `Refunded`), duyệt hoàn tiền sinh số phải hoàn và cấn trừ đợt còn nợ, phiếu nhập
 * hàng hoàn đưa thùng về tồn cách ly → làm mới qua root dùng chung (không import chéo feature).
 */

import { RETURN_LABELS, RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  approveReturn,
  approveSettlement,
  attachReturnEvidence,
  cancelReturn,
  closeWithoutRefund,
  markGoodsComplete,
  openReturnForCustomer,
  proposeRefund,
  rejectReturn,
  rejectSettlement,
} from "./api";
import { RETURN_STALE_CODES } from "./errors";
import { returnKeys, returnReceiptKeys } from "./queries";
import {
  cancelReturnReceipt,
  confirmReturnReceipt,
  createReturnReceipt,
  recordLooseLine,
  removeLooseLine,
  removeReturnCarton,
  scanReturnCarton,
} from "./receipt-api";

const S = RETURN_LABELS.success;
const R = RETURN_RECEIPT_LABELS.success;

/** Yêu cầu trả hàng + trạng thái đơn. */
const RETURN_INVALIDATION = [returnKeys.all, QUERY_ROOTS.orders] as const;
/** Duyệt / trả lại hoàn tiền: thêm số phải hoàn và các đợt bị cấn trừ. */
const SETTLEMENT_INVALIDATION = [
  ...RETURN_INVALIDATION,
  QUERY_ROOTS.paymentRefunds,
  QUERY_ROOTS.paymentInstallments,
] as const;
/** Phiếu nhập hàng hoàn: phiếu, yêu cầu (RECEIVED), đơn (Returned) và tồn cách ly. */
const RECEIPT_INVALIDATION = [
  returnReceiptKeys.all,
  ...RETURN_INVALIDATION,
  QUERY_ROOTS.inventoryStock,
] as const;

function returnMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string | undefined,
  invalidate: readonly (readonly string[])[],
) {
  return withStaleRefetch(
    createMutation<TInput, TResult>(fn, { invalidate, successMessage, showErrorToast: false }),
    invalidate,
    RETURN_STALE_CODES,
  );
}

export const useApproveReturn = returnMutation(approveReturn, S.approved, RETURN_INVALIDATION);
export const useRejectReturn = returnMutation(rejectReturn, S.rejected, RETURN_INVALIDATION);
export const useCancelReturn = returnMutation(cancelReturn, S.cancelled, RETURN_INVALIDATION);
export const useOpenReturnForCustomer = returnMutation(
  openReturnForCustomer,
  S.opened,
  RETURN_INVALIDATION,
);
export const useProposeRefund = returnMutation(proposeRefund, S.proposed, RETURN_INVALIDATION);
export const useApproveSettlement = returnMutation(
  approveSettlement,
  S.settlementApproved,
  SETTLEMENT_INVALIDATION,
);
export const useRejectSettlement = returnMutation(
  rejectSettlement,
  S.settlementRejected,
  RETURN_INVALIDATION,
);
/** WF-05 TH-3: AWAITING_RETURN → RECEIVED theo số đã về — đơn đổi trạng thái theo. */
export const useMarkGoodsComplete = returnMutation(
  markGoodsComplete,
  S.goodsComplete,
  RETURN_INVALIDATION,
);
/** WF-05 TH-4: RECEIVED → RESOLVED không hoàn tiền — không đụng số phải hoàn / các đợt. */
export const useCloseWithoutRefund = returnMutation(
  closeWithoutRefund,
  S.closedWithoutRefund,
  RETURN_INVALIDATION,
);
/** Ảnh bằng chứng chỉ thuộc yêu cầu. */
export const useAttachReturnEvidence = returnMutation(attachReturnEvidence, S.evidenceAdded, [
  returnKeys.all,
]);

export const useCreateReturnReceipt = returnMutation(
  createReturnReceipt,
  R.created,
  RECEIPT_INVALIDATION,
);
/** Quét thùng: không toast (thao tác lặp trên máy quét) — màn hiện phản hồi ngay ở ô quét. */
export const useScanReturnCarton = returnMutation(scanReturnCarton, undefined, [
  returnReceiptKeys.all,
]);
export const useRemoveReturnCarton = returnMutation(removeReturnCarton, R.removed, [
  returnReceiptKeys.all,
]);
/** Hàng lẻ chỉ ghi trên phiếu (không nhập tồn) — yêu cầu trả hàng đổi lúc xác nhận phiếu. */
export const useRecordLooseLine = returnMutation(recordLooseLine, R.looseRecorded, [
  returnReceiptKeys.all,
]);
export const useRemoveLooseLine = returnMutation(removeLooseLine, R.looseRemoved, [
  returnReceiptKeys.all,
]);
export const useConfirmReturnReceipt = returnMutation(
  confirmReturnReceipt,
  R.confirmed,
  RECEIPT_INVALIDATION,
);
export const useCancelReturnReceipt = returnMutation(
  cancelReturnReceipt,
  R.cancelled,
  RECEIPT_INVALIDATION,
);
