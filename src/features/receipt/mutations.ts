/**
 * Goods receipt — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi phiếu → `receiptKeys.all` (list + detail).
 * - Lập phiếu / lưu kiểm đếm / xác nhận / huỷ đổi số thùng phiếu nháp giữ chỗ và tiến độ Đơn sản xuất (docs 03 BR-02,
 *   §3 Output) → thêm root `production-orders` (màn Đơn sản xuất + ô chọn đơn của phiếu nhập).
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleReceiptError`) → tải lại phiếu ở MỌI mutation, để câu báo
 *   "Dữ liệu đã được tải lại" luôn đúng.
 */

import { useQueryClient } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { cancelGoodsReceipt, confirmGoodsReceipt } from "./api";
import { createProductionReceipt, replaceReceiptLines } from "./count-api";
import { isStaleReceiptError, receiptErrorMessage } from "./errors";
import { receiptKeys } from "./queries";

import type { ReplaceReceiptLinesVars } from "./count-api";
import type { GoodsReceipt, ProductionReceiptCreateInput } from "./types";

const RECEIPT_AND_PRODUCTION = [receiptKeys.all, [SHARED_QUERY_ROOTS.productionOrders]];

function toastError(error: unknown) {
  toast.error(receiptErrorMessage(error));
}

/**
 * Bọc hook mutation: lỗi do dữ liệu cũ → invalidate phiếu và Đơn sản xuất (`PRODUCTION_ORDER_NOT_RECEIVABLE` đổi cả ô
 * chọn đơn của dialog lập phiếu), rồi mới gọi onError của màn.
 */
function withStaleRefetch<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleReceiptError(args[0])) {
          for (const queryKey of RECEIPT_AND_PRODUCTION) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
        options?.onError?.(...args);
      },
    });
  };
}

export const useConfirmGoodsReceipt = withStaleRefetch(
  createMutation<string, GoodsReceipt>(confirmGoodsReceipt, {
    invalidate: RECEIPT_AND_PRODUCTION,
    successMessage: TOAST_MESSAGES.receipt.confirmed,
    showErrorToast: false,
    onError: toastError,
  }),
);

export const useCancelGoodsReceipt = withStaleRefetch(
  createMutation<string, GoodsReceipt>(cancelGoodsReceipt, {
    invalidate: RECEIPT_AND_PRODUCTION,
    successMessage: TOAST_MESSAGES.receipt.cancelled,
    showErrorToast: false,
    onError: toastError,
  }),
);

/** Docs 03 §4.1 bước 1 — lỗi hiện trong dialog (màn hình tự dịch qua `receiptErrorMessage`). */
export const useCreateProductionReceipt = withStaleRefetch(
  createMutation<ProductionReceiptCreateInput, GoodsReceipt>(createProductionReceipt, {
    invalidate: RECEIPT_AND_PRODUCTION,
    successMessage: TOAST_MESSAGES.receipt.created,
    showErrorToast: false,
  }),
);

/** Docs 03 §4.1 bước 2 — lỗi từng trường map về dòng form, lỗi chung hiện trên form (không toast). */
export const useReplaceReceiptLines = withStaleRefetch(
  createMutation<ReplaceReceiptLinesVars, GoodsReceipt>(replaceReceiptLines, {
    invalidate: RECEIPT_AND_PRODUCTION,
    successMessage: TOAST_MESSAGES.receipt.counted,
    showErrorToast: false,
  }),
);
