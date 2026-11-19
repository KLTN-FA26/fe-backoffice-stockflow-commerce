/**
 * Goods receipt — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi phiếu → `receiptKeys.all` (list + detail).
 * - Xác nhận còn đổi tiến độ Đơn sản xuất và tồn Inbound (docs 03 §3 Output). Màn Đơn sản xuất mới (SCRUM-756)
 *   và tồn kho chưa có query key dùng chung ở đây — khi lên thì thêm vào map này.
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleReceiptError`) → tải lại phiếu ở MỌI mutation, để câu báo
 *   "Dữ liệu đã được tải lại" luôn đúng.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { cancelGoodsReceipt, confirmGoodsReceipt } from "./api";
import { isStaleReceiptError, receiptErrorMessage } from "./errors";
import { receiptKeys } from "./queries";

import type { GoodsReceipt } from "./types";

function toastError(error: unknown) {
  toast.error(receiptErrorMessage(error));
}

/** Bọc hook mutation: lỗi do dữ liệu cũ → invalidate phiếu, rồi mới gọi onError của màn. */
function withStaleRefetch<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleReceiptError(args[0])) {
          void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
        }
        options?.onError?.(...args);
      },
    });
  };
}

export const useConfirmGoodsReceipt = withStaleRefetch(
  createMutation<string, GoodsReceipt>(confirmGoodsReceipt, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.confirmed,
    showErrorToast: false,
    onError: toastError,
  }),
);

export const useCancelGoodsReceipt = withStaleRefetch(
  createMutation<string, GoodsReceipt>(cancelGoodsReceipt, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.cancelled,
    showErrorToast: false,
    onError: toastError,
  }),
);
