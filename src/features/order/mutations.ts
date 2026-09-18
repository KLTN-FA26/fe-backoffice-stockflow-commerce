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
 * `showErrorToast: false` — call site tự map lỗi qua `adminCancelErrorView()`
 * (branch theo `error.code`), nếu để factory toast `error.message` sẽ ra 2 toast.
 */
export const useAdminCancelOrder = createMutation<AdminCancelOrderInput, void>(adminCancelOrder, {
  invalidate: [orderKeys.all],
  successMessage: "Đã huỷ đơn hàng",
  showErrorToast: false,
});
