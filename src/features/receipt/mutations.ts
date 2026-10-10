/**
 * Goods receipt — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi phiếu → `receiptKeys.all` (list + detail).
 * - Xác nhận nhận hàng còn đổi tiến độ PO (docs 03 §3 Output) → PO list/detail của màn PO và
 *   danh sách PO chờ nhận. Tồn kho (INBOUND / QUARANTINE / BLOCKED) cũng đổi, nhưng develop chưa
 *   có `inventoryKeys` — khi module tồn kho lên thì thêm vào đây.
 * - Lưu kiểm đếm và kết luận QC tắt toast lỗi mặc định: màn hình map lỗi inline theo dòng.
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleReceiptError`) → tải lại phiếu + PO ở MỌI mutation,
 *   để câu báo "Dữ liệu đã được tải lại" luôn đúng.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  createGoodsReceipt,
  inspectLine,
  moveLineToQc,
  replaceReceiptLines,
} from "./api";
import { isStaleReceiptError, receiptErrorMessage } from "./errors";
import { receiptKeys, receivablePoKeys } from "./queries";

import type {
  GoodsReceipt,
  InspectLineInput,
  MoveLineToQcInput,
  ReceiptCreateValues,
  SaveReceiptLinesInput,
} from "./types";

/** = `poKeys.all` của features/purchase-order — khai báo lại để không import chéo feature. */
const PURCHASE_ORDER_ROOT_KEY = ["purchase-orders"] as const;

function toastError(error: unknown) {
  toast.error(receiptErrorMessage(error));
}

const STALE_KEYS = [receiptKeys.all, receivablePoKeys.all] as const;

/** Bọc hook mutation: lỗi do dữ liệu cũ → invalidate phiếu + PO, rồi mới gọi onError của màn. */
function withStaleRefetch<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleReceiptError(args[0])) {
          for (const queryKey of STALE_KEYS) void queryClient.invalidateQueries({ queryKey });
        }
        options?.onError?.(...args);
      },
    });
  };
}

export const useCreateGoodsReceipt = withStaleRefetch(
  createMutation<ReceiptCreateValues, GoodsReceipt>(createGoodsReceipt, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.created,
    showErrorToast: false,
    onError: toastError,
  }),
);

export const useSaveReceiptLines = withStaleRefetch(
  createMutation<SaveReceiptLinesInput, GoodsReceipt>(replaceReceiptLines, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.linesSaved,
    showErrorToast: false,
  }),
);

export const useConfirmGoodsReceipt = withStaleRefetch(
  createMutation<string, GoodsReceipt>(confirmGoodsReceipt, {
    invalidate: [receiptKeys.all, receivablePoKeys.all, PURCHASE_ORDER_ROOT_KEY],
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

export const useMoveLineToQc = withStaleRefetch(
  createMutation<MoveLineToQcInput, GoodsReceipt>(moveLineToQc, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.movedToQc,
    // Dialog hiện lỗi inline
    showErrorToast: false,
  }),
);

export const useInspectLine = withStaleRefetch(
  createMutation<InspectLineInput, GoodsReceipt>(inspectLine, {
    invalidate: [receiptKeys.all],
    successMessage: TOAST_MESSAGES.receipt.inspected,
    showErrorToast: false,
  }),
);
