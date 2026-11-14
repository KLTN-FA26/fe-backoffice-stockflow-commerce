/**
 * Duyệt / từ chối yêu cầu huỷ của khách — mutation hooks (BE `CancellationRequestController`, docs 17 §4.8 bước 28).
 *
 * Duyệt huỷ đơn trong cùng giao dịch, nên tác dụng phụ giống huỷ admin: nhả giữ chỗ tồn (`RESERVATION_CHANGE_INVALIDATIONS`),
 * dừng task lấy hàng của kho (`fulfillmentTasks`) — BE `OrderCancellationListener` huỷ pick + put-back. Từ chối chỉ đổi
 * yêu cầu (nằm dưới `orderKeys.all`). `showErrorToast: false`: call site map lỗi theo `error.code` ngay trong hộp thoại
 * (`cancellation-request-errors.ts`).
 */

import { CANCELLATION_REQUEST_LABELS, SHARED_QUERY_ROOTS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { approveCancellationRequest, rejectCancellationRequest } from "./cancellation-request-api";
import { orderKeys } from "./queries";

import type { CancellationDecisionVars } from "./cancellation-request-api";
import type {
  ApproveCancellationValues,
  CancellationRequest,
  RejectCancellationValues,
} from "./cancellation-request-schemas";
import type { Order } from "./types";

export const useApproveCancellationRequest = createMutation<
  CancellationDecisionVars<ApproveCancellationValues>,
  Order
>(approveCancellationRequest, {
  invalidate: [
    orderKeys.all,
    ...RESERVATION_CHANGE_INVALIDATIONS,
    [SHARED_QUERY_ROOTS.fulfillmentTasks],
  ],
  successMessage: CANCELLATION_REQUEST_LABELS.approve.success,
  showErrorToast: false,
});

export const useRejectCancellationRequest = createMutation<
  CancellationDecisionVars<RejectCancellationValues>,
  CancellationRequest
>(rejectCancellationRequest, {
  invalidate: [orderKeys.all],
  successMessage: CANCELLATION_REQUEST_LABELS.reject.success,
  showErrorToast: false,
});
