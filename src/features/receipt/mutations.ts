/**
 * Goods receipt — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi phiếu → `receiptKeys.all` (list + detail).
 * - Xác nhận nhận hàng còn đổi tiến độ PO (docs 03 §3 Output) → PO list/detail của màn PO và
 *   danh sách PO chờ nhận. Tồn kho (INBOUND / QUARANTINE / BLOCKED) cũng đổi, nhưng develop chưa
 *   có `inventoryKeys` — khi module tồn kho lên thì thêm vào đây.
 * - Xác nhận mà đếm vượt dung sai (BR-RCP-001) KHÔNG ghi nhận: phiếu sang `Pending Approval`, PO chưa đổi
 *   nhưng vẫn invalidate như khi ghi nhận cho đơn giản (một query thừa, không sai dữ liệu).
 * - Duyệt / từ chối phần vượt (Quản lý kho) ghi nhận tồn như xác nhận → cùng map invalidate với xác nhận.
 * - Lưu kiểm đếm và kết luận QC tắt toast lỗi mặc định: màn hình map lỗi inline theo dòng.
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleReceiptError`) → tải lại phiếu + PO ở MỌI mutation,
 *   để câu báo "Dữ liệu đã được tải lại" luôn đúng.
 */

import { useQueryClient } from "@tanstack/react-query";

import { RECEIPT_STATUS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  approveGoodsReceipt,
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  createGoodsReceipt,
  inspectLine,
  moveLineToQc,
  rejectReceiptExcess,
  replaceReceiptLines,
} from "./api";
import { isStaleReceiptError, receiptErrorMessage } from "./errors";
import { receiptKeys, receivablePoKeys } from "./queries";

import type {
  DecideReceiptInput,
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
    // Không dùng `successMessage` tĩnh: đếm vượt dung sai thì chưa nhập kho, chỉ gửi Quản lý kho duyệt
    onSuccess: (receipt) =>
      toast.success(
        receipt.status === RECEIPT_STATUS.PENDING_APPROVAL
          ? TOAST_MESSAGES.receipt.sentForApproval
          : TOAST_MESSAGES.receipt.confirmed,
      ),
    showErrorToast: false,
    onError: toastError,
  }),
);

/** BR-RCP-001: Quản lý kho duyệt — ghi nhận đủ SL đã đếm. Lỗi hiện trong dialog (có ô lý do). */
export const useApproveGoodsReceipt = withStaleRefetch(
  createMutation<DecideReceiptInput, GoodsReceipt>(approveGoodsReceipt, {
    invalidate: [receiptKeys.all, receivablePoKeys.all, PURCHASE_ORDER_ROOT_KEY],
    successMessage: TOAST_MESSAGES.receipt.approved,
    showErrorToast: false,
  }),
);

/** BR-RCP-001: từ chối phần vượt — chỉ ghi nhận tới dung sai; không còn gì thì phiếu bị huỷ. */
export const useRejectReceiptExcess = withStaleRefetch(
  createMutation<DecideReceiptInput, GoodsReceipt>(rejectReceiptExcess, {
    invalidate: [receiptKeys.all, receivablePoKeys.all, PURCHASE_ORDER_ROOT_KEY],
    onSuccess: (receipt) =>
      toast.success(
        receipt.status === RECEIPT_STATUS.CANCELLED
          ? TOAST_MESSAGES.receipt.excessRejectedNothingLeft
          : TOAST_MESSAGES.receipt.excessRejected,
      ),
    showErrorToast: false,
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
