/**
 * Order — mutation hooks.
 *
 * `createMutation` thuần (KHÔNG `createTransitionMutation`): mỗi thao tác là một endpoint POST
 * riêng (`/admin-cancellation`, `/release`, `/credit-approval`, `/credit-rejection`, `/hold`,
 * `/hold/resolution`, `/delivery-failure`, `/remainder-closure`), không phải PATCH status chung.
 * Mọi endpoint trả `OrderResponse` → hook trả `Order` đã parse.
 *
 * Biến = `OrderMutationVars<T>`: id + input + `idempotencyKey` (header, không vào body). Key do màn hình
 * cấp theo "một lần thử logic" (`useOrderActionErrors().idempotencyKeyFor`); mutation KHÔNG tự retry
 * (`query-client.ts`: `mutations.retry = false`) nên không bao giờ phát thao tác nghiệp vụ thứ hai.
 *
 * Invalidation map (api-conventions §2.3) — theo tác dụng phụ thật của BE:
 * - mọi thao tác đổi trạng thái đơn → `orderKeys.all` (list + detail + history + lệnh sản xuất +
 *   credit holds đều nằm dưới key này).
 * - thao tác đổi giữ chỗ tồn còn invalidate tồn + phiếu giữ hàng qua `RESERVATION_CHANGE_INVALIDATIONS`
 *   (`lib/api/shared-query-keys.ts`, không import chéo feature):
 *   - huỷ admin → nhả giữ chỗ (BE OrderServiceImpl.cancelLoaded → releaseHolds)
 *   - release → ghim giữ chỗ vào kho xuất (BE OrderReleaseService.release → pinReservations)
 *   - từ chối công nợ → huỷ (nhả) hoặc chuyển trả trước / đặt cọc (rearmReservations)
 *   - đóng phần còn lại → nhả giữ chỗ phần không giao (BE OrderServiceImpl.closeRemainder → releaseHolds)
 * - duyệt công nợ, giữ, gỡ giữ, giao thất bại: BE không gọi inventory → chỉ `orderKeys.all`.
 * Không invalidate sổ cái (movements) — giữ chỗ không ghi bút toán tồn.
 *
 * `showErrorToast: false` — call site tự map lỗi theo `error.code` (`errors.ts`) và hiện lý do
 * từ chối ngay trong dialog; để factory toast `error.message` (tiếng Anh) sẽ ra 2 thông báo.
 */

import { ORDER_ACTION_LABELS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { approveCreditHold, rejectCreditHold, releaseOrder } from "./action-api";
import {
  adminCancelOrder,
  closeOrderRemainder,
  holdOrder,
  recordDeliveryFailure,
  resolveOrderHold,
} from "./api";
import { orderKeys } from "./queries";

import type {
  DeliveryFailureInput,
  HoldOrderInput,
  OrderMutationVars,
  RemainderClosureInput,
  ResolveOrderHoldInput,
} from "./api";
import type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionInput,
  Order,
  ReleaseOrderInput,
} from "./types";

const ORDER_ONLY = [orderKeys.all] as const;
const ORDER_AND_RESERVATIONS = [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS] as const;

export const useAdminCancelOrder = createMutation<OrderMutationVars<AdminCancelOrderInput>, Order>(
  adminCancelOrder,
  {
    invalidate: ORDER_AND_RESERVATIONS,
    successMessage: TOAST_MESSAGES.order.cancelled,
    showErrorToast: false,
  },
);

export const useReleaseOrder = createMutation<OrderMutationVars<ReleaseOrderInput>, Order>(
  releaseOrder,
  {
    invalidate: ORDER_AND_RESERVATIONS,
    successMessage: TOAST_MESSAGES.order.released,
    showErrorToast: false,
  },
);

export const useApproveCreditHold = createMutation<OrderMutationVars<CreditApprovalInput>, Order>(
  approveCreditHold,
  {
    invalidate: ORDER_ONLY,
    successMessage: TOAST_MESSAGES.order.creditApproved,
    showErrorToast: false,
  },
);

export const useRejectCreditHold = createMutation<OrderMutationVars<CreditRejectionInput>, Order>(
  rejectCreditHold,
  {
    invalidate: ORDER_AND_RESERVATIONS,
    successMessage: TOAST_MESSAGES.order.creditRejected,
    showErrorToast: false,
  },
);

/* ── Hold / resolve / delivery-failure / remainder-closure (BE PR #133) ── */
// `showErrorToast: false`: call site map lỗi qua `orderActionErrorView()` (branch theo `error.code`).

export const useHoldOrder = createMutation<HoldOrderInput, Order>(holdOrder, {
  invalidate: ORDER_ONLY,
  successMessage: ORDER_ACTION_LABELS.hold.success,
  showErrorToast: false,
});

export const useResolveOrderHold = createMutation<ResolveOrderHoldInput, Order>(resolveOrderHold, {
  invalidate: ORDER_ONLY,
  successMessage: ORDER_ACTION_LABELS.resolveHold.success,
  showErrorToast: false,
});

export const useRecordDeliveryFailure = createMutation<DeliveryFailureInput, Order>(
  recordDeliveryFailure,
  {
    invalidate: ORDER_ONLY,
    successMessage: ORDER_ACTION_LABELS.deliveryFailure.success,
    showErrorToast: false,
  },
);

/** Đóng phần còn lại nhả giữ chỗ của phần không giao (BE releaseHolds) → cả cache tồn / phiếu giữ hàng. */
export const useCloseOrderRemainder = createMutation<RemainderClosureInput, Order>(
  closeOrderRemainder,
  {
    invalidate: ORDER_AND_RESERVATIONS,
    successMessage: ORDER_ACTION_LABELS.remainderClosure.success,
    showErrorToast: false,
  },
);
