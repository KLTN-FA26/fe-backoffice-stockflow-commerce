/**
 * Order — mutation hooks.
 *
 * `createMutation` thuần (KHÔNG `createTransitionMutation`): admin-cancel là một
 * endpoint POST riêng biệt (`/orders/:id/admin-cancellation`), không phải PATCH
 * status chung.
 */

import { createMutation } from "@/lib/api/query-factory";

import { ORDER_ACTION_LABELS } from "@/constants";

import {
  adminCancelOrder,
  closeOrderRemainder,
  decidePartialShipment,
  holdOrder,
  recordDeliveryFailure,
  resolveOrderHold,
  type AdminCancelOrderInput,
  type DeliveryFailureInput,
  type HoldOrderInput,
  type PartialShipmentInput,
  type RemainderClosureInput,
  type ResolveOrderHoldInput,
} from "./api";
import { orderKeys } from "./queries";

/* ── Admin cancel ────────────────────────────────────────────────────── */

/**
 * Invalidation map (api-conventions §2.3): huỷ đơn đổi trạng thái đơn (list + detail →
 * `orderKeys.all`) và giải phóng giữ chỗ tồn (BE `OrderStatus#holdsStock`: PENDING_PAYMENT…PACKED/ON_HOLD
 * giữ hàng). Module tồn kho chưa có query nào (`features/inventory` mới là
 * stub) nên chưa có key để invalidate — khi có `inventoryKeys`/`reservationKeys` thì thêm vào đây
 * (qua page/lib/domain, không import chéo feature).
 *
 * `showErrorToast: false` — call site tự map lỗi qua `adminCancelErrorView()`
 * (branch theo `error.code`), nếu để factory toast `error.message` sẽ ra 2 toast.
 */
export const useAdminCancelOrder = createMutation<AdminCancelOrderInput, void>(adminCancelOrder, {
  invalidate: [orderKeys.all],
  successMessage: "Đã huỷ đơn hàng",
  showErrorToast: false,
});

/* ── Hold / resolve / delivery-failure / remainder-closure (BE PR #133) ── */

/**
 * Cả bốn đổi trạng thái đơn → `orderKeys.all` (list + detail). Đóng phần còn lại còn tạo yêu cầu
 * hoàn tiền (module thanh toán) và dừng phần còn lại ở kho — chưa có query FE tương ứng để invalidate.
 * `showErrorToast: false`: call site map lỗi qua `orderActionErrorView()` (branch theo `error.code`).
 */
export const useHoldOrder = createMutation<HoldOrderInput, void>(holdOrder, {
  invalidate: [orderKeys.all],
  successMessage: ORDER_ACTION_LABELS.hold.success,
  showErrorToast: false,
});

export const useResolveOrderHold = createMutation<ResolveOrderHoldInput, void>(resolveOrderHold, {
  invalidate: [orderKeys.all],
  successMessage: ORDER_ACTION_LABELS.resolveHold.success,
  showErrorToast: false,
});

export const useRecordDeliveryFailure = createMutation<DeliveryFailureInput, void>(
  recordDeliveryFailure,
  {
    invalidate: [orderKeys.all],
    successMessage: ORDER_ACTION_LABELS.deliveryFailure.success,
    showErrorToast: false,
  },
);

export const useCloseOrderRemainder = createMutation<RemainderClosureInput, void>(
  closeOrderRemainder,
  {
    invalidate: [orderKeys.all],
    successMessage: ORDER_ACTION_LABELS.remainderClosure.success,
    showErrorToast: false,
  },
);

/* ── Giao một phần (BE PR #150) ──────────────────────────────────────── */

/**
 * Cho phép / dừng giao một phần của đơn. Đổi cờ `allowPartialShipment` của đơn (detail + list) và thêm một mục
 * vào lịch sử đơn — cả hai nằm dưới `orderKeys.all`. Màn đóng gói / bàn giao đọc cờ này qua BE khi gọi
 * (không giữ bản sao ở FE) nên không có key khác để làm mới.
 * Không có `successMessage` cố định: lời báo phụ thuộc `allowed` nên call site phát toast; `showErrorToast: false`
 * vì call site map lỗi (409 ORDER_PARTIAL_SHIPMENT_LOCKED…) ngay trong dialog.
 */
export const useDecidePartialShipment = createMutation<PartialShipmentInput, void>(
  decidePartialShipment,
  {
    invalidate: [orderKeys.all],
    showErrorToast: false,
  },
);
