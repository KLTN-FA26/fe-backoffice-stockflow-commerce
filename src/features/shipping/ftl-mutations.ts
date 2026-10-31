/**
 * Shipping — mutations chuyến nguyên xe (BE PR #162): đặt xe, huỷ đặt xe, bắt đầu xếp hàng, dỡ kiện.
 * Dùng chung bộ bọc cache của `mutations.ts` (response ghi thẳng vào cache chi tiết chuyến). Mỗi thao tác
 * đổi trạng thái xe của kế hoạch → invalidate cả danh sách chuyến và kế hoạch xếp xe.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import {
  bookLoad,
  cancelLoadBooking,
  cancelLoadControlled,
  overrideUnload,
  startLoading,
  unloadPackage,
} from "./ftl-api";
import {
  LOAD_LIST_KEY,
  LOAD_PLAN_ROOT_KEY,
  toastError,
  toastIfStale,
  withLoadCache,
} from "./mutations";
import { isStaleLoadError } from "./errors";
import { loadKeys, manifestKey, shipmentKeys } from "./queries";

import type {
  BookLoadInput,
  CancelBookingInput,
  ControlledCancelLoadInput,
  ControlledCancelResult,
  Load,
  OverrideUnloadInput,
  StartLoadingInput,
  UnloadPackageInput,
} from "./types";

const T = TOAST_MESSAGES.shipping;
const INVALIDATE = [LOAD_LIST_KEY, LOAD_PLAN_ROOT_KEY];

/** Hộp thoại đặt xe hiện lỗi inline; lỗi dữ liệu cũ vẫn toast (hộp thoại có thể đóng ngay khi tải lại). */
export const useBookLoad = withLoadCache(
  createMutation<BookLoadInput, Load>(bookLoad, {
    invalidate: INVALIDATE,
    successMessage: T.booked,
    showErrorToast: false,
    onError: toastIfStale,
  }),
  (input) => input.loadId,
);

export const useCancelLoadBooking = withLoadCache(
  createMutation<CancelBookingInput, Load>(cancelLoadBooking, {
    invalidate: INVALIDATE,
    successMessage: T.bookingCancelled,
    showErrorToast: false,
    onError: toastIfStale,
  }),
  (input) => input.loadId,
);

/** Xác nhận đơn giản (không có ô nhập) → lỗi hiện bằng toast. */
export const useStartLoading = withLoadCache(
  createMutation<StartLoadingInput, Load>(startLoading, {
    invalidate: INVALIDATE,
    successMessage: T.loadingStarted,
    showErrorToast: false,
    onError: toastError,
  }),
  (input) => input.loadId,
);

/** Lỗi dỡ kiện hiện inline ở ô quét dỡ, không toast. Kế hoạch cũng tải lại: danh sách kiện còn phải dỡ ở đó ngắn đi. */
export const useUnloadPackage = withLoadCache(
  createMutation<UnloadPackageInput, Load>(unloadPackage, {
    invalidate: [LOAD_LIST_KEY, LOAD_PLAN_ROOT_KEY],
    // Kiện cuối dỡ xong thì bảng "cần dỡ" biến mất cùng phản hồi của ô quét → báo thêm bằng toast
    successMessage: T.unloaded,
    showErrorToast: false,
  }),
  (input) => input.loadId,
);

/** Quản lý kho xác nhận dỡ kiện không cần quét (nhãn hỏng); lỗi hiện trong hộp thoại xác nhận. */
export const useOverrideUnload = withLoadCache(
  createMutation<OverrideUnloadInput, Load>(overrideUnload, {
    invalidate: [LOAD_LIST_KEY, LOAD_PLAN_ROOT_KEY],
    successMessage: T.unloadOverridden,
    showErrorToast: false,
    onError: toastIfStale,
  }),
  (input) => input.loadId,
);

const useControlledCancelBase = createMutation<ControlledCancelLoadInput, ControlledCancelResult>(
  cancelLoadControlled,
  {
    invalidate: [LOAD_LIST_KEY, LOAD_PLAN_ROOT_KEY, shipmentKeys.all],
    showErrorToast: false,
  },
);

/**
 * Huỷ có kiểm soát MỘT xe (SCRUM-474), bọc cache như `withLoadCache` (mutation trả hai chuyến): huỷ GET chi tiết đang chạy của
 * chuyến vừa huỷ trước khi gửi và khi có kết quả (GET về sau sẽ ghi đè bản cũ), ghi chuyến đã huỷ lẫn chuyến thay thế vào cache
 * chi tiết — không bản cũ hơn đang có —, và gặp lỗi dữ liệu cũ (`isStaleLoadError`, vd 409 INVALID_LOAD_TRANSITION khi xe vừa
 * đổi trạng thái ở nơi khác) thì tải lại chuyến + lô giao và toast, như các mutation anh em. Lỗi hiện trong hộp thoại.
 */
export function useCancelLoadControlled(options?: Parameters<typeof useControlledCancelBase>[0]) {
  const queryClient = useQueryClient();
  return useControlledCancelBase({
    ...options,
    onMutate: async (input, context) => {
      await queryClient.cancelQueries({ queryKey: loadKeys.detail(input.loadId) });
      return options?.onMutate?.(input, context);
    },
    onSuccess: async (result, ...rest) => {
      for (const load of [result.cancelled, result.replacement]) {
        if (!load) continue;
        await queryClient.cancelQueries({ queryKey: loadKeys.detail(load.loadId) });
        queryClient.setQueryData<Load>(loadKeys.detail(load.loadId), (cached) =>
          cached && cached.version > load.version ? cached : load,
        );
        void queryClient.invalidateQueries({ queryKey: manifestKey(load.loadId) });
      }
      toast.success(
        result.replacement ? T.controlledCancelled : T.controlledCancelledNoReplacement,
      );
      options?.onSuccess?.(result, ...rest);
    },
    onError: (...args) => {
      const [error, input] = args;
      if (isStaleLoadError(error)) {
        void queryClient.invalidateQueries({ queryKey: loadKeys.all });
        void queryClient.invalidateQueries({ queryKey: shipmentKeys.all });
        toastIfStale(error);
      } else {
        // GET đã bị huỷ ở onMutate nên thay đổi từ máy khác (nếu có) chưa về
        void queryClient.invalidateQueries({ queryKey: loadKeys.detail(input.loadId) });
      }
      options?.onError?.(...args);
    },
  });
}
