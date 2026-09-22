/**
 * Purchase Order — mutation hooks.
 *
 * One hook per BE endpoint (PurchaseOrderController.java):
 * approval / sending / cancellation / closure-short / receipts.
 */

import { createMutation } from "@/lib/api/query-factory";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closeShortPurchaseOrder,
  createPurchaseOrder,
  receiveGoods,
  sendPurchaseOrder,
  transitionPurchaseOrder,
  type CreatePoInput,
  type CreatePoResult,
  type TransitionPoInput,
} from "./api";
import { poKeys, poDashboardKeys, replenishmentKeys, supplierSpendKeys } from "./queries";
import type { PurchaseOrder } from "./types";

/* ── Create ──────────────────────────────────────────────────────────── */

export const useCreatePo = createMutation<CreatePoInput, CreatePoResult>(createPurchaseOrder, {
  invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all],
  successMessage: "Tạo đơn đặt hàng thành công",
});

/* ── Per-action transitions ──────────────────────────────────────────── */

export const useApprovePo = createMutation<{ id: string }, PurchaseOrder>(
  ({ id }) => approvePurchaseOrder(id),
  {
    invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all, replenishmentKeys.all],
    successMessage: "Phê duyệt thành công",
  },
);

export const useSendPo = createMutation<{ id: string }, PurchaseOrder>(
  ({ id }) => sendPurchaseOrder(id),
  {
    invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all],
    successMessage: "Đã gửi tới NCC",
  },
);

export const useCancelPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => cancelPurchaseOrder(id, reason),
  {
    invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all],
    successMessage: "Đã huỷ PO",
  },
);

export const useCloseShortPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => closeShortPurchaseOrder(id, reason),
  {
    invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all],
    successMessage: "Đã đóng thiếu",
  },
);

export const useReceiveGoodsPo = createMutation<
  { id: string; lines: { lineId: string; quantity: number }[] },
  PurchaseOrder
>(({ id, lines }) => receiveGoods(id, lines), {
  invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all],
  successMessage: "Đã ghi nhận nhận hàng",
});

/* Compat — delegates to per-action endpoints (new code should use the hooks above). */
export const useTransitionPo = createMutation<TransitionPoInput, PurchaseOrder>(
  transitionPurchaseOrder,
  {
    invalidate: [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all, replenishmentKeys.all],
    successMessage: "Chuyển trạng thái thành công",
  },
);
