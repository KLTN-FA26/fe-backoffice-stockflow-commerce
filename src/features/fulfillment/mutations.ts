/**
 * Fulfillment task — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi task → `fulfillmentKeys.all` (list + detail của cả hai màn).
 * - Tạo task còn đổi trạng thái ĐƠN (READY_TO_FULFILL → PICKING — BE PR #133, docs 17 §5) → màn đơn hàng và dữ liệu
 *   đơn của feature này. Tồn kho chưa đổi ở bước này nên không invalidate tồn (trừ tồn ở bước xác nhận dòng với đích
 *   DISPATCH — `pick-line-mutations.ts` — và khi chuyển cả tác vụ `Staged` sang khu xuất hàng — `useMoveToDispatch`).
 *   Thao tác của trạm đóng gói (nhận đơn, quét, kiện, hoàn tất) nằm ở `packing-mutations.ts`.
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleFulfillmentError`) → tải lại ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  assignFulfillmentTask,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  moveToDispatch,
  startPicking,
} from "./api";
import { fulfillmentErrorMessage, isStaleFulfillmentError } from "./errors";
import { fulfillmentKeys, fulfillmentReferenceKeys } from "./queries";

import type { FulfillmentErrorContext } from "./errors";
import type {
  ArtifactAccess,
  ArtifactUrlInput,
  AssignTaskInput,
  CreateTaskValues,
  FulfillmentTask,
} from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;

const TOAST = TOAST_MESSAGES.fulfillment;
const TASK_KEYS = [fulfillmentKeys.all] as const;
export const TASK_AND_ORDER_KEYS = [
  fulfillmentKeys.all,
  fulfillmentReferenceKeys.orders(),
  ORDER_ROOT_KEY,
] as const;

const toastError = (context: FulfillmentErrorContext) => (error: unknown) =>
  toast.error(fulfillmentErrorMessage(error, context));

/**
 * Bọc hook mutation: lỗi do dữ liệu cũ → invalidate task + đơn (dòng lấy hàng nằm dưới `fulfillmentKeys.all`),
 * rồi mới gọi onError của màn.
 */
export function withStaleRefetch<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleFulfillmentError(args[0])) {
          for (const queryKey of TASK_AND_ORDER_KEYS) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
        options?.onError?.(...args);
      },
    });
  };
}

export const useCreateFulfillmentTask = withStaleRefetch(
  createMutation<CreateTaskValues, FulfillmentTask>(createFulfillmentTask, {
    invalidate: TASK_AND_ORDER_KEYS,
    // Dialog hiện lỗi inline
    showErrorToast: false,
    // Đơn đã có task → BE trả task cũ nguyên trạng, vẫn 201 (FulfillmentServiceImpl#createTask),
    // không có dấu hiệu nào khác trong response. Dấu hiệu duy nhất FE thấy được: người được gán
    // khác người vừa chọn. Trùng người thì không phân biệt được, nhưng kết quả khi đó vẫn đúng ý.
    onSuccess: (task, input) =>
      task.assignedUserId === input.assignedUserId
        ? toast.success(TOAST.created)
        : toast.warning(TOAST.alreadyExists),
  }),
);

export const useAssignFulfillmentTask = withStaleRefetch(
  createMutation<AssignTaskInput, FulfillmentTask>(assignFulfillmentTask, {
    invalidate: TASK_KEYS,
    successMessage: TOAST.assigned,
    showErrorToast: false,
  }),
);

export const useStartPicking = withStaleRefetch(
  createMutation<string, FulfillmentTask>(startPicking, {
    invalidate: TASK_KEYS,
    successMessage: TOAST.pickingStarted,
    showErrorToast: false,
    onError: toastError("pick"),
  }),
);

export const useCompletePicking = withStaleRefetch(
  createMutation<string, FulfillmentTask>(completePicking, {
    invalidate: TASK_KEYS,
    successMessage: TOAST.pickingCompleted,
    showErrorToast: false,
    onError: toastError("pick"),
  }),
);

export const useMoveToDispatch = withStaleRefetch(
  createMutation<string, FulfillmentTask>(moveToDispatch, {
    // Trừ tồn các thùng ở khu chờ xuất ngay trong giao dịch (docs 07 §4.3 bước 8) → làm mới cả tồn kho và đơn
    invalidate: [...TASK_AND_ORDER_KEYS, [SHARED_QUERY_ROOTS.inventoryStock]],
    successMessage: TOAST.movedToDispatch,
    showErrorToast: false,
    onError: toastError("dispatch"),
  }),
);

/**
 * Lấy URL ký khi người dùng bấm tải — không cache (xem `useDesignArtifact` cho bản xem trước).
 * Màn hình tự báo lỗi vì câu chữ phụ thuộc task có đang bị giữ hay không.
 */
export const useDesignArtifactDownload = createMutation<ArtifactUrlInput, ArtifactAccess>(
  (input) => getDesignArtifactUrl(input),
  { showErrorToast: false },
);
