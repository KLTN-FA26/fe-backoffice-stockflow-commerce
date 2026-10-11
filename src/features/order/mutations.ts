/**
 * Order — mutation hooks.
 *
 * `createMutation` thuần (KHÔNG `createTransitionMutation`): mỗi thao tác là một endpoint POST
 * riêng (`/admin-cancellation`, `/release`, `/credit-approval`, `/credit-rejection`), không phải
 * PATCH status chung.
 *
 * Invalidation map (api-conventions §2.3): mọi thao tác đổi trạng thái đơn → `orderKeys.all`
 * (list + detail + history + lệnh sản xuất + credit holds đều nằm dưới key này).
 * Thao tác đổi giữ chỗ tồn (BE `OrderStatus#holdsStock`) còn invalidate tồn + phiếu giữ hàng
 * qua `RESERVATION_CHANGE_INVALIDATIONS` (`lib/api/shared-query-keys.ts`, không import chéo feature):
 *   - huỷ admin → nhả giữ chỗ (BE OrderServiceImpl.cancelLoaded)
 *   - release → ghim giữ chỗ vào kho xuất (BE OrderReleaseService.release)
 *   - từ chối công nợ → huỷ (nhả) hoặc chuyển trả trước / đặt cọc (giữ chỗ lại) (BE CreditHoldService.refuse)
 * Duyệt công nợ: ON_HOLD → CONFIRMED, cả hai đều giữ hàng → giữ chỗ không đổi, chỉ `orderKeys.all`.
 * Không invalidate sổ cái (movements) — giữ chỗ không ghi bút toán tồn.
 *
 * `showErrorToast: false` — call site tự map lỗi theo `error.code` (`errors.ts`) và hiện lý do
 * từ chối ngay trong dialog; để factory toast `error.message` (tiếng Anh) sẽ ra 2 thông báo.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { approveCreditHold, rejectCreditHold, releaseOrder } from "./action-api";
import { adminCancelOrder } from "./api";
import { orderKeys } from "./queries";

import type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionInput,
  Order,
  ReleaseOrderInput,
} from "./types";

type WithId<T> = T & { id: string };

export const useAdminCancelOrder = createMutation<WithId<AdminCancelOrderInput>, Order>(
  adminCancelOrder,
  {
    invalidate: [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS],
    successMessage: TOAST_MESSAGES.order.cancelled,
    showErrorToast: false,
  },
);

export const useReleaseOrder = createMutation<WithId<ReleaseOrderInput>, Order>(releaseOrder, {
  invalidate: [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS],
  successMessage: TOAST_MESSAGES.order.released,
  showErrorToast: false,
});

export const useApproveCreditHold = createMutation<WithId<CreditApprovalInput>, Order>(
  approveCreditHold,
  {
    invalidate: [orderKeys.all],
    successMessage: TOAST_MESSAGES.order.creditApproved,
    showErrorToast: false,
  },
);

export const useRejectCreditHold = createMutation<WithId<CreditRejectionInput>, Order>(
  rejectCreditHold,
  {
    invalidate: [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS],
    successMessage: TOAST_MESSAGES.order.creditRejected,
    showErrorToast: false,
  },
);
