/**
 * Mutation Đơn sản xuất + invalidation (api-conventions §2.3), theo liên kết module trong docs 17:
 * - mọi thao tác đổi chi tiết + danh sách Đơn sản xuất (`production-orders`);
 * - lịch sản xuất + đợt còn thiếu (§4.12) và cờ trễ (tự mở / đóng theo trạng thái, ngày dự kiến — bước 48–49);
 * - đơn bán: duyệt đẩy đơn sang Awaiting Stock (§4.3 bước 7), trang đơn hiện Đơn sản xuất của từng dòng.
 * Lỗi hiện trong dialog đã map tiếng Việt → tắt toast lỗi mặc định.
 */

import { PRODUCTION_TOAST_MESSAGES as T, SHARED_QUERY_ROOTS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  acceptProductionOrder,
  approveProductionOrder,
  cancelProductionOrder,
  changeExpectedCompletion,
  closeProductionOrder,
  drawUpProductionOrder,
  editProductionOrder,
  resendDispatch,
  returnProductionOrder,
  startProduction,
  submitProductionOrder,
} from "./api";
import { isStaleProductionOrderError } from "./errors";
import { productionOrderKeys } from "./queries";

const AFFECTED = [
  productionOrderKeys.all,
  [SHARED_QUERY_ROOTS.productionSchedule],
  [SHARED_QUERY_ROOTS.delayAlerts],
  [SHARED_QUERY_ROOTS.salesOrders],
] as const;

function action<TInput, TResult>(fn: (input: TInput) => Promise<TResult>, successMessage: string) {
  return withStaleRefetch(
    createMutation(fn, { invalidate: AFFECTED, successMessage, showErrorToast: false }),
    AFFECTED,
    isStaleProductionOrderError,
  );
}

export const useDrawUpProductionOrder = action(drawUpProductionOrder, T.drawnUp);
export const useEditProductionOrder = action(editProductionOrder, T.edited);
export const useSubmitProductionOrder = action(submitProductionOrder, T.submitted);
export const useApproveProductionOrder = action(approveProductionOrder, T.approved);
export const useReturnProductionOrder = action(returnProductionOrder, T.returned);
export const useAcceptProductionOrder = action(acceptProductionOrder, T.accepted);
export const useChangeExpectedCompletion = action(changeExpectedCompletion, T.expectedChanged);
export const useStartProduction = action(startProduction, T.productionStarted);
export const useCancelProductionOrder = action(cancelProductionOrder, T.cancelled);
export const useCloseProductionOrder = action(closeProductionOrder, T.closed);

/** Gửi lại mail: chỉ đổi lịch sử gửi của đơn này. */
export const useResendDispatch = createMutation(resendDispatch, {
  invalidate: [productionOrderKeys.all],
  successMessage: T.resent,
  showErrorToast: false,
});
