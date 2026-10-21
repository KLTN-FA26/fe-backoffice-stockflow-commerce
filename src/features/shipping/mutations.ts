/**
 * Shipping — mutations chuyến xe + invalidation map (api-conventions §2.3).
 *
 * - Mọi thao tác trả chuyến mới nhất → ghi thẳng vào cache chi tiết (màn quét không nháy lại), chỉ
 *   invalidate danh sách (tiến độ) và lô giao (trạng thái / chuyến của lô đổi).
 * - Bàn giao: lô HANDED_OVER + đơn hàng chuyển SHIPPED (BR-03 docs 09 §6) → invalidate lô giao và đơn.
 * - Lỗi trạng thái cũ (`isStaleLoadError`) → tải lại chuyến và lô ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  addLoadShipments,
  cancelLoad,
  handoverLoad,
  openLoad,
  removeLoadShipment,
  scanPackage,
  unscanPackage,
} from "./api";
import { isStaleLoadError, shippingErrorMessage } from "./errors";
import { loadKeys, manifestKey, shipmentKeys } from "./queries";
import { useRejectedScansStore } from "./rejected-scans-store";

import type {
  CancelLoadInput,
  HandoverLoadInput,
  Load,
  LoadShipmentsInput,
  OpenLoadInput,
  RemoveLoadShipmentInput,
  ScanPackageInput,
  UnscanInput,
} from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;
const LOAD_LIST_KEY = [...loadKeys.all, "list"] as const;
const T = TOAST_MESSAGES.shipping;

/**
 * Bọc mutation trả `Load`: ghi response vào cache chi tiết (không bản cũ hơn) và tải lại khi gặp lỗi
 * dữ liệu cũ. `loadIdOf` có thì huỷ GET chi tiết đang chạy của đúng chuyến đó trước khi gửi — GET về
 * SAU response sẽ ghi đè bằng bản cũ (kiện vừa quét nhảy về "Chưa lên xe", bàn giao dùng version cũ
 * → OPTIMISTIC_LOCK).
 */
function withLoadCache<TInput>(
  useBase: ReturnType<typeof createMutation<TInput, Load>>,
  loadIdOf?: (input: TInput) => string,
) {
  return function useWithLoadCache(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onMutate: async (input, context) => {
        if (loadIdOf) {
          await queryClient.cancelQueries({ queryKey: loadKeys.detail(loadIdOf(input)) });
        }
        return options?.onMutate?.(input, context);
      },
      onSuccess: async (load, ...rest) => {
        // GET bắt đầu TRONG lúc POST chạy mang bản cũ hơn response này → huỷ trước khi ghi cache
        await queryClient.cancelQueries({ queryKey: loadKeys.detail(load.loadId) });
        queryClient.setQueryData<Load>(loadKeys.detail(load.loadId), (cached) =>
          cached && cached.version > load.version ? cached : load,
        );
        void queryClient.invalidateQueries({ queryKey: manifestKey(load.loadId) });
        options?.onSuccess?.(load, ...rest);
      },
      onError: (...args) => {
        const [error, input] = args;
        if (isStaleLoadError(error)) {
          void queryClient.invalidateQueries({ queryKey: loadKeys.all });
          void queryClient.invalidateQueries({ queryKey: shipmentKeys.all });
        } else if (loadIdOf) {
          // GET đã bị huỷ ở onMutate nên thay đổi từ máy khác (nếu có) chưa về
          void queryClient.invalidateQueries({ queryKey: loadKeys.detail(loadIdOf(input)) });
        }
        options?.onError?.(...args);
      },
    });
  };
}

const toastError = (error: unknown) => toast.error(shippingErrorMessage(error));

/** Dialog hiện lỗi inline (`showErrorToast: false`); lỗi dữ liệu cũ vẫn toast vì dialog có thể đóng ngay. */
const toastIfStale = (error: unknown) => {
  if (isStaleLoadError(error)) toastError(error);
};

export const useOpenLoad = withLoadCache(
  createMutation<OpenLoadInput, Load>(openLoad, {
    invalidate: [LOAD_LIST_KEY, shipmentKeys.all],
    successMessage: T.loadOpened,
    showErrorToast: false,
    onError: toastIfStale,
  }),
);

export const useAddLoadShipments = withLoadCache(
  createMutation<LoadShipmentsInput, Load>(addLoadShipments, {
    invalidate: [LOAD_LIST_KEY, shipmentKeys.all],
    successMessage: T.shipmentsAdded,
    showErrorToast: false,
    onError: toastIfStale,
  }),
  (input) => input.loadId,
);

export const useRemoveLoadShipment = withLoadCache(
  createMutation<RemoveLoadShipmentInput, Load>(removeLoadShipment, {
    invalidate: [LOAD_LIST_KEY, shipmentKeys.all],
    successMessage: T.shipmentRemoved,
    showErrorToast: false,
    onError: toastError,
  }),
  (input) => input.loadId,
);

/** Lỗi quét hiện inline ở ô quét, không toast. */
export const useScanPackage = withLoadCache(
  createMutation<ScanPackageInput, Load>(scanPackage, {
    invalidate: [LOAD_LIST_KEY],
    showErrorToast: false,
  }),
  (input) => input.loadId,
);

export const useUnscanPackage = withLoadCache(
  createMutation<UnscanInput, Load>(unscanPackage, {
    invalidate: [LOAD_LIST_KEY],
    successMessage: T.unscanned,
    showErrorToast: false,
    onError: toastError,
  }),
  (input) => input.loadId,
);

export const useHandoverLoad = withLoadCache(
  createMutation<HandoverLoadInput, Load>(handoverLoad, {
    invalidate: [loadKeys.all, shipmentKeys.all, ORDER_ROOT_KEY],
    successMessage: T.handedOver,
    // Dialog bàn giao hiện lỗi inline; lỗi dữ liệu cũ thì toast (dialog có thể đóng ngay khi tải lại)
    showErrorToast: false,
    onError: toastIfStale,
    // Đã bàn giao → danh sách mã quét không thành công của chuyến (lưu tạm trên máy) hết ý nghĩa
    onSuccess: (load) => useRejectedScansStore.getState().clear(load.loadId),
  }),
  (input) => input.loadId,
);

export const useCancelLoad = withLoadCache(
  createMutation<CancelLoadInput, Load>(cancelLoad, {
    invalidate: [loadKeys.all, shipmentKeys.all],
    successMessage: T.cancelled,
    showErrorToast: false,
    onError: toastIfStale,
    onSuccess: (load) => useRejectedScansStore.getState().clear(load.loadId),
  }),
  (input) => input.loadId,
);
