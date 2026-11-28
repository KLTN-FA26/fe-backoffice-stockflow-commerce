/**
 * Mutations thanh toán + invalidation map (docs 15). Lập / huỷ phiếu thu đổi trạng thái các đợt, và
 * qua đó đổi trạng thái đơn (`Pending Payment` → `Confirmed`, treo đơn), chặn / mở bàn giao chuyến xe
 * → thêm root `orders` và `fulfillment-loads` (root dùng chung, không import chéo feature).
 */

import { SHARED_QUERY_ROOTS } from "@/constants";

import { saveFile } from "@/lib/api/file-download";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { exportReceipts, recordReceipt, recordRefund, voidReceipt, voidRefundRecord } from "./api";
import { PAYMENT_STALE_CODES } from "./errors";
import type { ReceiptFilterParams } from "./api";
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

// Không có thông báo nổi chung: nơi gọi (`useRecordedReceipt`) báo số tiền + liên kết phiếu (S07-5).
export const useRecordReceipt = paymentMutation(recordReceipt, "", RECEIPT_INVALIDATION);
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

/** Xuất Excel phiếu thu: chỉ đọc nên không invalidate; lỗi hiện tại chỗ nút (`EXPORT_TOO_LARGE`), không toast. */
export const useExportReceipts = createMutation(
  (input: { filter: ReceiptFilterParams; fallbackName: string }) =>
    exportReceipts(input.filter, input.fallbackName),
  { onSuccess: saveFile, showErrorToast: false },
);
