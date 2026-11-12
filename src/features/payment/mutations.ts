/**
 * Mutations thanh toán + invalidation map (docs 15). Lập / huỷ phiếu thu đổi trạng thái các đợt, và
 * qua đó đổi trạng thái đơn (`Pending Payment` → `Confirmed`, treo đơn), chặn / mở bàn giao chuyến xe
 * → thêm root `orders` và `fulfillment-loads` (root dùng chung, không import chéo feature).
 */

import { SHARED_QUERY_ROOTS } from "@/constants";

import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { recordReceipt, recordRefund, voidReceipt, voidRefundRecord } from "./api";
import { PAYMENT_STALE_CODES } from "./errors";
import { installmentKeys, receiptKeys, refundKeys } from "./queries";

const ORDER_ROOT = QUERY_ROOTS.orders;
const LOAD_ROOT = [SHARED_QUERY_ROOTS.fulfillmentLoads] as const;

/** Phiếu thu đổi đợt, đơn và chặn bàn giao: làm mới cả bốn nhóm. */
const RECEIPT_INVALIDATION = [
  receiptKeys.all,
  installmentKeys.all,
  refundKeys.all,
  ORDER_ROOT,
  LOAD_ROOT,
] as const;

function paymentMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
  invalidate: readonly (readonly string[])[],
) {
  return withStaleRefetch(
    createMutation<TInput, TResult>(fn, { invalidate, successMessage, showErrorToast: false }),
    invalidate,
    PAYMENT_STALE_CODES,
  );
}

export const useRecordReceipt = paymentMutation(
  recordReceipt,
  "Đã lập phiếu thu.",
  RECEIPT_INVALIDATION,
);
export const useVoidReceipt = paymentMutation(
  voidReceipt,
  "Đã huỷ phiếu thu.",
  RECEIPT_INVALIDATION,
);
export const useRecordRefund = paymentMutation(recordRefund, "Đã ghi nhận hoàn tiền.", [
  refundKeys.all,
  ORDER_ROOT,
]);
export const useVoidRefundRecord = paymentMutation(voidRefundRecord, "Đã huỷ ghi nhận hoàn tiền.", [
  refundKeys.all,
  ORDER_ROOT,
]);
