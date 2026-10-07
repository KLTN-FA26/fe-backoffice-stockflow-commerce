/**
 * Order — mutation hooks.
 *
 * `createMutation` thuần (KHÔNG `createTransitionMutation`): admin-cancel là một
 * endpoint POST riêng biệt (`/orders/:id/admin-cancellation`), không phải PATCH
 * status chung.
 */

import { createMutation } from "@/lib/api/query-factory";

import { adminCancelOrder, type AdminCancelOrderInput } from "./api";
import { orderKeys } from "./queries";

/* ── Admin cancel ────────────────────────────────────────────────────── */

/**
 * Invalidation map (api-conventions §2.3): huỷ đơn đổi trạng thái đơn (list + detail →
 * `orderKeys.all`) và giải phóng giữ chỗ tồn (BE `OrderStatus#holdsStock`: PENDING_PAYMENT/PAID/
 * IN_FULFILMENT/ON_HOLD giữ hàng). Module tồn kho chưa có query nào (`features/inventory` mới là
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
