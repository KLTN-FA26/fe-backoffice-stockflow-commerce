/**
 * Transfer order — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi lệnh → `transferKeys.all` (list + detail).
 * - Xuất kho còn đổi tồn kho nguồn (TRANSFER_OUT, giữ ở trạng thái đi đường — docs 10 §4 bước 5),
 *   nhưng develop chưa có query tồn kho (SCRUM-439 chưa merge) — khi có thì thêm key ở đây.
 * - Tắt toast lỗi mặc định (message BE tiếng Anh): toast câu tiếng Việt qua `transferErrorMessage`;
 *   form tạo / sửa tắt luôn toast vì hiện lỗi inline.
 * - Lỗi "dữ liệu đã đổi" (`isStaleTransferError`) → tải lại lệnh ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES, TRANSFER_STATUS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  approveTransferOrder,
  cancelTransferOrder,
  cancelTransferPicking,
  createTransferOrder,
  dispatchTransferOrder,
  rejectTransferOrder,
  startTransferPicking,
  submitTransferOrder,
  updateTransferOrder,
} from "./api";
import { isStaleTransferError, transferErrorMessage } from "./errors";
import { transferKeys } from "./queries";

import type {
  DispatchTransferInput,
  TransferFormValues,
  TransferOrder,
  TransferReasonInput,
  UpdateTransferInput,
} from "./types";

const MSG = TOAST_MESSAGES.transfer;

function toastError(error: unknown) {
  toast.error(transferErrorMessage(error));
}

function withStaleRefetch<TInput>(
  useBase: ReturnType<typeof createMutation<TInput, TransferOrder>>,
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleTransferError(args[0])) {
          void queryClient.invalidateQueries({ queryKey: transferKeys.all });
        }
        options?.onError?.(...args);
      },
    });
  };
}

/** Thao tác chuyển trạng thái: invalidate lệnh + toast thành công / lỗi tiếng Việt. */
function transition<TInput>(fn: (input: TInput) => Promise<TransferOrder>, successMessage: string) {
  return withStaleRefetch(
    createMutation<TInput, TransferOrder>(fn, {
      invalidate: [transferKeys.all],
      successMessage,
      showErrorToast: false,
      onError: toastError,
    }),
  );
}

export const useCreateTransferOrder = withStaleRefetch(
  createMutation<TransferFormValues, TransferOrder>(createTransferOrder, {
    invalidate: [transferKeys.all],
    successMessage: MSG.created,
    // Form hiện lỗi inline
    showErrorToast: false,
  }),
);

export const useUpdateTransferOrder = withStaleRefetch(
  createMutation<UpdateTransferInput, TransferOrder>(updateTransferOrder, {
    invalidate: [transferKeys.all],
    successMessage: MSG.updated,
    showErrorToast: false,
  }),
);

// docs 10 §4 bước 3 + §5 "Draft → Approved: Submit (dưới ngưỡng)": tổng SL ≤ ngưỡng thì BE duyệt luôn (APPROVED) — toast theo trạng thái BE trả về
export const useSubmitTransferOrder = withStaleRefetch(
  createMutation<string, TransferOrder>(submitTransferOrder, {
    invalidate: [transferKeys.all],
    showErrorToast: false,
    onSuccess: (transfer) =>
      toast.success(
        transfer.status === TRANSFER_STATUS.APPROVED ? MSG.submittedApproved : MSG.submitted,
      ),
    onError: toastError,
  }),
);
export const useApproveTransferOrder = transition<string>(approveTransferOrder, MSG.approved);
export const useRejectTransferOrder = transition<TransferReasonInput>(
  rejectTransferOrder,
  MSG.rejected,
);
export const useStartTransferPicking = transition<string>(startTransferPicking, MSG.pickingStarted);
export const useCancelTransferPicking = transition<string>(
  cancelTransferPicking,
  MSG.pickingCancelled,
);
export const useCancelTransferOrder = transition<TransferReasonInput>(
  cancelTransferOrder,
  MSG.cancelled,
);

export const useDispatchTransferOrder = withStaleRefetch(
  createMutation<DispatchTransferInput, TransferOrder>(dispatchTransferOrder, {
    invalidate: [transferKeys.all],
    successMessage: MSG.dispatched,
    // Dialog xuất kho hiện lỗi inline (vd INSUFFICIENT_STOCK)
    showErrorToast: false,
  }),
);
