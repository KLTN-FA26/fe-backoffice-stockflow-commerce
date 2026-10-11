/**
 * Fulfillment task — mutations + invalidation map (api-conventions §2.3).
 *
 * - Mọi mutation đổi task → `fulfillmentKeys.all` (list + detail của cả hai màn).
 * - Tạo task / đóng gói / kiểm tra lại còn đổi trạng thái ĐƠN (CONFIRMED → IN_FULFILMENT,
 *   IN_FULFILMENT ⇄ ON_HOLD — docs 17 §5) → màn đơn hàng và dữ liệu đơn của feature này.
 *   Tồn kho chưa đổi ở các bước này (BE chưa có dòng lấy hàng) nên không invalidate tồn.
 * - Đóng gói và kiểm tra lại KHÔNG có `successMessage` cố định: BE trả 200 cả khi lệch checksum
 *   (pack `On Hold`), toast chọn theo `packStatus` của kết quả.
 * - Lỗi "dữ liệu đã đổi ở nơi khác" (`isStaleFulfillmentError`) → tải lại ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  assignFulfillmentTask,
  completePacking,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  reverifyDesignIntegrity,
  startPicking,
} from "./api";
import { fulfillmentErrorMessage, isStaleFulfillmentError } from "./errors";
import { fulfillmentArtifactKeys, fulfillmentKeys, fulfillmentReferenceKeys } from "./queries";
import { isOnDesignHold } from "./selectors";

import type { FulfillmentErrorContext } from "./errors";
import type {
  ArtifactAccess,
  ArtifactUrlInput,
  AssignTaskInput,
  CreateTaskValues,
  FulfillmentTask,
  ReverifyTaskInput,
} from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;

const TOAST = TOAST_MESSAGES.fulfillment;
const TASK_KEYS = [fulfillmentKeys.all] as const;
const TASK_AND_ORDER_KEYS = [
  fulfillmentKeys.all,
  fulfillmentReferenceKeys.orders(),
  ORDER_ROOT_KEY,
] as const;

const toastError = (context: FulfillmentErrorContext) => (error: unknown) =>
  toast.error(fulfillmentErrorMessage(error, context));

/** Bọc hook mutation: lỗi do dữ liệu cũ → invalidate task + đơn, rồi mới gọi onError của màn. */
function withStaleRefetch<TInput, TResult>(
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

/**
 * Kết quả đối chiếu có thể đã đổi → URL file thiết kế của task phải lấy lại. Tách khỏi
 * `fulfillmentKeys` để gán / lấy hàng / đóng gói khớp không bắt BE băm lại bundle.
 */
function useRefreshArtifacts() {
  const queryClient = useQueryClient();
  return (taskId: string) =>
    void queryClient.invalidateQueries({ queryKey: fulfillmentArtifactKeys.task(taskId) });
}

const useCompletePackingBase = withStaleRefetch(
  createMutation<string, FulfillmentTask>(completePacking, {
    invalidate: TASK_AND_ORDER_KEYS,
    showErrorToast: false,
    // X-CHK: lệch checksum là kết quả 200, không phải lỗi
    onSuccess: (task) =>
      isOnDesignHold(task) ? toast.warning(TOAST.held) : toast.success(TOAST.packed),
    onError: toastError("pack"),
  }),
);

export function useCompletePacking(options?: Parameters<typeof useCompletePackingBase>[0]) {
  const refreshArtifacts = useRefreshArtifacts();
  return useCompletePackingBase({
    ...options,
    onSuccess: (...args) => {
      // Vừa phát hiện lệch → ảnh đang hiện có thể là file sai, lấy lại để BE trả đúng tình trạng
      if (isOnDesignHold(args[0])) refreshArtifacts(args[0].taskId);
      options?.onSuccess?.(...args);
    },
  });
}

const useReverifyDesignIntegrityBase = withStaleRefetch(
  createMutation<ReverifyTaskInput, FulfillmentTask>(reverifyDesignIntegrity, {
    invalidate: TASK_AND_ORDER_KEYS,
    // Dialog hiện lỗi inline — kể cả trường hợp vẫn lệch (200 + `On Hold`), nên không toast thêm
    showErrorToast: false,
    onSuccess: (task) => {
      if (!isOnDesignHold(task)) toast.success(TOAST.reverified);
    },
  }),
);

export function useReverifyDesignIntegrity(
  options?: Parameters<typeof useReverifyDesignIntegrityBase>[0],
) {
  const refreshArtifacts = useRefreshArtifacts();
  return useReverifyDesignIntegrityBase({
    ...options,
    onSuccess: (...args) => {
      refreshArtifacts(args[0].taskId);
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Lấy URL ký khi người dùng bấm tải — không cache (xem `useDesignArtifact` cho bản xem trước).
 * Màn hình tự báo lỗi vì câu chữ phụ thuộc task có đang bị giữ hay không.
 */
export const useDesignArtifactDownload = createMutation<ArtifactUrlInput, ArtifactAccess>(
  (input) => getDesignArtifactUrl(input),
  { showErrorToast: false },
);
