/**
 * Trạm đóng gói — mutations + invalidation map (api-conventions §2.3).
 *
 * - Câu trả lời dạng phiên (start / scan / remove / void) được ghi thẳng vào cache phiên: không
 *   chờ tải lại, quét liên tục thấy số "Đã đóng" đổi ngay. Thao tác trả về kiện (open / seal /
 *   reopen) làm mới phiên.
 * - Lỗi "phiên đã đổi ở nơi khác" (`isStalePackingError`) → tải lại phiên, hàng chờ, task và đơn ở MỌI
 *   mutation.
 * - Hoàn tất đóng gói KHÔNG có `successMessage` cố định: BE trả 200 cả khi lệch checksum (pack
 *   `On Hold`, không có lô giao), toast chọn theo kết quả. Đổi trạng thái đơn → invalidate đơn.
 */

import { useQueryClient } from "@tanstack/react-query";

import { PACK_STATUS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  completePacking,
  openPackage,
  removeUnits,
  reopenPackage,
  scanIntoPackage,
  sealPackage,
  startPacking,
  voidPackage,
} from "./packing-api";
import { isStalePackingError, packingErrorMessage } from "./packing-errors";
import { packingKeys } from "./packing-queries";
import { clearCompletionRequestId } from "./packing-request-id";
import { fulfillmentArtifactKeys, fulfillmentKeys, fulfillmentReferenceKeys } from "./queries";
import { isOnDesignHold } from "./selectors";

import type {
  CompletePackingInput,
  OpenPackageInput,
  PackPackage,
  PackageRef,
  PackingSession,
  RemoveUnitsInput,
  ScanPackageInput,
  SealPackageInput,
} from "./packing-types";
import type { FulfillmentTask } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;
const TOAST = TOAST_MESSAGES.packing;
const STALE_KEYS = [
  fulfillmentKeys.all,
  fulfillmentReferenceKeys.orders(),
  ORDER_ROOT_KEY,
] as const;
const PACKAGE_KEYS = [packingKeys.sessions(), packingKeys.queues()] as const;

const toastError = (error: unknown) => toast.error(packingErrorMessage(error));

/** Bọc hook mutation: lỗi do phiên đã cũ → tải lại; kết quả là phiên → ghi vào cache phiên. */
function withPacking<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
  toSession?: (result: TResult) => PackingSession | undefined,
) {
  return function useWithPacking(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onSuccess: (...args) => {
        const session = toSession?.(args[0]);
        if (session) queryClient.setQueryData(packingKeys.session(session.taskId), session);
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        if (isStalePackingError(args[0])) {
          for (const queryKey of STALE_KEYS) void queryClient.invalidateQueries({ queryKey });
        }
        options?.onError?.(...args);
      },
    });
  };
}

const asSession = (session: PackingSession) => session;

export const useStartPacking = withPacking(
  createMutation<string, PackingSession>(startPacking, {
    invalidate: [packingKeys.queues()],
    successMessage: TOAST.started,
    showErrorToast: false,
  }),
  asSession,
);

export const useOpenPackage = withPacking(
  createMutation<OpenPackageInput, PackPackage>(openPackage, {
    invalidate: PACKAGE_KEYS,
    successMessage: TOAST.packageOpened,
    showErrorToast: false,
    onError: toastError,
  }),
);

/** Không toast thành công: màn quét tự hiện phản hồi từng lần quét. */
export const useScanPackage = withPacking(
  createMutation<ScanPackageInput, PackingSession>(scanIntoPackage, {
    invalidate: [packingKeys.queues()],
    showErrorToast: false,
  }),
  asSession,
);

export const useRemoveUnits = withPacking(
  createMutation<RemoveUnitsInput, PackingSession>(removeUnits, {
    invalidate: [packingKeys.queues()],
    successMessage: TOAST.removed,
    showErrorToast: false,
  }),
  asSession,
);

export const useSealPackage = withPacking(
  createMutation<SealPackageInput, PackPackage>(sealPackage, {
    invalidate: PACKAGE_KEYS,
    successMessage: TOAST.sealed,
    showErrorToast: false,
  }),
);

export const useReopenPackage = withPacking(
  createMutation<PackageRef, PackPackage>(reopenPackage, {
    invalidate: PACKAGE_KEYS,
    successMessage: TOAST.reopened,
    showErrorToast: false,
    onError: toastError,
  }),
);

export const useVoidPackage = withPacking(
  createMutation<PackageRef, PackingSession>(voidPackage, {
    invalidate: [packingKeys.queues()],
    successMessage: TOAST.voided,
    showErrorToast: false,
    onError: toastError,
  }),
  asSession,
);

/** Toast của kết quả hoàn tất: lệch thiết kế (200, không có lô) / giao một phần / xong cả đơn. */
function completionToast(task: FulfillmentTask): void {
  if (isOnDesignHold(task)) toast.warning(TOAST.held);
  else toast.success(task.packStatus === PACK_STATUS.PACKED ? TOAST.packed : TOAST.shippedPartial);
}

const useCompletePackingBase = withPacking(
  createMutation<CompletePackingInput, FulfillmentTask>(completePacking, {
    invalidate: STALE_KEYS,
    showErrorToast: false,
    onSuccess: (task, input) => {
      // Lô giao đã tạo → lần giao tiếp theo phải có requestId mới (xem `packing-request-id.ts`)
      if (task.shipmentId) clearCompletionRequestId(input.taskId);
      completionToast(task);
    },
  }),
);

export function useCompletePacking(options?: Parameters<typeof useCompletePackingBase>[0]) {
  const queryClient = useQueryClient();
  return useCompletePackingBase({
    ...options,
    onSuccess: (...args) => {
      // Vừa phát hiện lệch → ảnh thiết kế đang hiện có thể là file sai, lấy lại để BE trả đúng tình trạng
      if (isOnDesignHold(args[0])) {
        void queryClient.invalidateQueries({
          queryKey: fulfillmentArtifactKeys.task(args[0].taskId),
        });
      }
      options?.onSuccess?.(...args);
    },
  });
}
