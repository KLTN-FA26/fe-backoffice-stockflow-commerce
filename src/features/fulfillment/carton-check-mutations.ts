/**
 * Trạm kiểm thùng — mutations + invalidation map (api-conventions §2.3).
 *
 * - Câu trả lời dạng phiên (start / quét / dán nhãn / in lại / loại thùng) được ghi thẳng vào cache phiên: không chờ
 *   tải lại, quét liên tục thấy số "Đã quét" đổi ngay.
 * - Thùng đầu tiên được dán nhãn khoá đơn (docs 08 BR-04: không huỷ, không đổi địa chỉ giao) → dán nhãn làm mới cả
 *   đơn. Loại thùng đưa thùng vào hàng chờ cất lại (docs 08 §4.2 bước 4) → làm mới hàng đợi trả về kệ.
 * - Lỗi "phiên đã đổi ở nơi khác" (`isStaleCartonCheckError`) → tải lại phiên, hàng chờ, task và đơn ở MỌI mutation.
 * - Hoàn tất KHÔNG có `successMessage` cố định: toast chọn theo kết quả (đủ thùng / giao một phần); `paymentDue` chỉ
 *   là cảnh báo, hoàn tất vẫn thành công (docs 08 §4.4 bước 9, BR-11). Kiểm thùng không trừ tồn (BR-10).
 */

import { useQueryClient } from "@tanstack/react-query";

import { PACK_STATUS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  checkCarton,
  completeCartonCheck,
  labelCartons,
  printShippingLabels,
  removeCarton,
  reprintCartonLabel,
  startCartonCheck,
} from "./carton-check-api";
import { isStaleCartonCheckError } from "./carton-check-errors";
import { cartonCheckKeys } from "./carton-check-queries";
import { clearCompletionRequestId } from "./carton-check-request-id";
import { TASK_AND_ORDER_KEYS } from "./mutations";
import { putBackKeys } from "./queries";

import type {
  CartonCheckSession,
  CartonRemovalInput,
  CartonReprintInput,
  CartonScanInput,
  CartonSelectionInput,
  CompleteCartonCheckInput,
  ShippingLabelsPdf,
} from "./carton-check-types";
import type { FulfillmentTask } from "./types";

const TOAST = TOAST_MESSAGES.cartonCheck;

/** Bọc hook mutation: lỗi do phiên đã cũ → tải lại; kết quả là phiên → ghi vào cache phiên. */
function withCartonCheck<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
  toSession?: (result: TResult) => CartonCheckSession | undefined,
) {
  return function useWithCartonCheck(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onSuccess: (...args) => {
        const session = toSession?.(args[0]);
        if (session) queryClient.setQueryData(cartonCheckKeys.session(session.taskId), session);
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        if (isStaleCartonCheckError(args[0])) {
          for (const queryKey of TASK_AND_ORDER_KEYS) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
        options?.onError?.(...args);
      },
    });
  };
}

const asSession = (session: CartonCheckSession) => session;

export const useStartCartonCheck = withCartonCheck(
  createMutation<string, CartonCheckSession>(startCartonCheck, {
    invalidate: [cartonCheckKeys.queues()],
    successMessage: TOAST.started,
    showErrorToast: false,
  }),
  asSession,
);

/** Không toast thành công: màn quét tự hiện phản hồi từng lần quét. */
export const useCheckCarton = withCartonCheck(
  createMutation<CartonScanInput, CartonCheckSession>(checkCarton, {
    invalidate: [cartonCheckKeys.queues()],
    showErrorToast: false,
  }),
  asSession,
);

export const useLabelCartons = withCartonCheck(
  createMutation<CartonSelectionInput, CartonCheckSession>(labelCartons, {
    // Thùng đầu tiên dán nhãn khoá đơn (BR-04) → màn đơn thấy đơn không huỷ được nữa
    invalidate: [cartonCheckKeys.queues(), ...TASK_AND_ORDER_KEYS],
    successMessage: TOAST.labeled,
    showErrorToast: false,
  }),
  asSession,
);

export const useReprintCartonLabel = withCartonCheck(
  createMutation<CartonReprintInput, CartonCheckSession>(reprintCartonLabel, {
    invalidate: [cartonCheckKeys.sessions()],
    successMessage: TOAST.reprinted,
    showErrorToast: false,
  }),
  asSession,
);

export const useRemoveCarton = withCartonCheck(
  createMutation<CartonRemovalInput, CartonCheckSession>(removeCarton, {
    // Thùng bị loại vào hàng chờ cất lại → làm mới hàng đợi trả về kệ
    invalidate: [cartonCheckKeys.queues(), putBackKeys.all],
    successMessage: TOAST.removed,
    showErrorToast: false,
  }),
  asSession,
);

/** Chỉ tạo file PDF — BE không đổi gì, nên không invalidate và không toast. */
export const usePrintShippingLabels = withCartonCheck(
  createMutation<CartonSelectionInput, ShippingLabelsPdf>(printShippingLabels, {
    showErrorToast: false,
  }),
);

/** Toast của kết quả hoàn tất: giao một phần (phiên còn In Progress) / xong cả đơn (Completed). */
function completionToast(task: FulfillmentTask): void {
  toast.success(task.packStatus === PACK_STATUS.COMPLETED ? TOAST.packed : TOAST.shippedPartial);
}

export const useCompleteCartonCheck = withCartonCheck(
  createMutation<CompleteCartonCheckInput, FulfillmentTask>(completeCartonCheck, {
    invalidate: [...TASK_AND_ORDER_KEYS],
    showErrorToast: false,
    onSuccess: (task, input) => {
      // Shipment đã tạo → lần hoàn tất tiếp theo phải có requestId mới (xem `carton-check-request-id.ts`)
      if (task.shipmentId) clearCompletionRequestId(input.taskId);
      completionToast(task);
    },
  }),
);
