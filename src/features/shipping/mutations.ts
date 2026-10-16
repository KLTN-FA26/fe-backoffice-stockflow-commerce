/**
 * Shipping — mutations + invalidation map (api-conventions §2.3).
 *
 * - Quét kiện: response là chuyến mới nhất → ghi thẳng vào cache detail (màn quét không nháy lại),
 *   chỉ invalidate danh sách (tiến độ loaded/planned). Lỗi quét hiện inline ở ô quét, không toast.
 * - Bàn giao: chuyến DISPATCHED + đơn hàng có thể chuyển SHIPPED (BR-03 docs 09 §6) → invalidate
 *   chuyến và đơn hàng.
 * - Lỗi trạng thái cũ (`isStaleLoadError`) → tải lại chuyến ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { handoverLoad, scanPackage, startLoading } from "./api";
import { isStaleLoadError, shippingErrorMessage } from "./errors";
import { loadKeys } from "./queries";
import { useRejectedScansStore } from "./rejected-scans-store";

import type { HandoverLoadInput, Load, ScanPackageInput } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;
const LOAD_LIST_KEY = [...loadKeys.all, "list"] as const;

function withLoadCache<TInput>(
  useBase: ReturnType<typeof createMutation<TInput, Load>>,
  loadIdOf: (input: TInput) => string,
) {
  return function useWithLoadCache(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      // GET chi tiết đang chạy (refetch khi focus…) trả về SAU response này sẽ ghi đè bằng bản cũ:
      // kiện vừa quét nhảy về "Chưa lên xe", bàn giao dùng version cũ → OPTIMISTIC_LOCK
      // Chỉ huỷ GET của đúng chuyến đang thao tác — không đụng truy vấn của chuyến / màn khác
      onMutate: async (input, context) => {
        await queryClient.cancelQueries({ queryKey: loadKeys.detail(loadIdOf(input)) });
        return options?.onMutate?.(input, context);
      },
      onSuccess: async (load, ...rest) => {
        // GET bắt đầu TRONG lúc POST chạy (focus, invalidate của mã quét trước) mang bản cũ hơn response
        // này → huỷ trước khi ghi cache, nếu không nó về sau và ghi đè. Huỷ hoàn tác cache ngay (đồng
        // bộ) về trạng thái trước GET, rồi mới ghi response
        await queryClient.cancelQueries({ queryKey: loadKeys.detail(load.loadId) });
        queryClient.setQueryData<Load>(loadKeys.detail(load.loadId), (cached) =>
          cached && cached.version > load.version ? cached : load,
        );
        options?.onSuccess?.(load, ...rest);
      },
      onError: (...args) => {
        // Dữ liệu cũ → tải lại cả chuyến lẫn danh sách. Lỗi khác vẫn tải lại chi tiết chuyến: GET đã bị
        // huỷ ở onMutate nên thay đổi từ máy khác (nếu có) chưa về
        void queryClient.invalidateQueries({
          queryKey: isStaleLoadError(args[0]) ? loadKeys.all : loadKeys.detail(loadIdOf(args[1])),
        });
        options?.onError?.(...args);
      },
    });
  };
}

export const useStartLoading = withLoadCache(
  createMutation<string, Load>(startLoading, {
    invalidate: [LOAD_LIST_KEY],
    successMessage: TOAST_MESSAGES.shipping.loadingStarted,
    showErrorToast: false,
    onError: (error) => toast.error(shippingErrorMessage(error)),
  }),
  (loadId) => loadId,
);

export const useScanPackage = withLoadCache(
  createMutation<ScanPackageInput, Load>(scanPackage, {
    invalidate: [LOAD_LIST_KEY],
    showErrorToast: false,
  }),
  (input) => input.loadId,
);

export const useHandoverLoad = withLoadCache(
  createMutation<HandoverLoadInput, Load>(handoverLoad, {
    invalidate: [loadKeys.all, ORDER_ROOT_KEY],
    successMessage: TOAST_MESSAGES.shipping.handedOver,
    // Dialog bàn giao hiện lỗi inline. Riêng lỗi dữ liệu cũ thì toast ở đây (không ở dialog): dữ liệu
    // tải lại có thể làm dialog đóng ngay (chuyến không còn bàn giao được) — callback của dialog khi
    // đó không còn chạy, lỗi sẽ mất
    showErrorToast: false,
    onError: (error) => {
      if (isStaleLoadError(error)) toast.error(shippingErrorMessage(error));
    },
    // Đã bàn giao → danh sách mã quét không thành công của chuyến (lưu tạm trên máy) hết ý nghĩa
    onSuccess: (load) => useRejectedScansStore.getState().clear(load.loadId),
  }),
  (input) => input.loadId,
);
