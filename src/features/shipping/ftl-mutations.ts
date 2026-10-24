/**
 * Shipping — mutations chuyến nguyên xe (BE PR #162): đặt xe, huỷ đặt xe, bắt đầu xếp hàng, dỡ kiện.
 * Dùng chung bộ bọc cache của `mutations.ts` (response ghi thẳng vào cache chi tiết chuyến). Mỗi thao tác
 * đổi trạng thái xe của kế hoạch → invalidate cả danh sách chuyến và kế hoạch xếp xe.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { bookLoad, cancelLoadBooking, startLoading, unloadPackage } from "./ftl-api";
import {
  LOAD_LIST_KEY,
  LOAD_PLAN_ROOT_KEY,
  toastError,
  toastIfStale,
  withLoadCache,
} from "./mutations";

import type {
  BookLoadInput,
  CancelBookingInput,
  Load,
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

/** Lỗi dỡ kiện hiện inline ở ô quét dỡ, không toast. */
export const useUnloadPackage = withLoadCache(
  createMutation<UnloadPackageInput, Load>(unloadPackage, {
    invalidate: [LOAD_LIST_KEY],
    // Kiện cuối dỡ xong thì bảng "cần dỡ" biến mất cùng phản hồi của ô quét → báo thêm bằng toast
    successMessage: T.unloaded,
    showErrorToast: false,
  }),
  (input) => input.loadId,
);
