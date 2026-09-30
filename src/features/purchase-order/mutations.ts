/**
 * Purchase Order — mutation hooks.
 *
 * One hook per BE endpoint (PurchaseOrderController.java):
 * approval / sending / cancellation / closure-short / receipts.
 *
 * The success toast comes from `successMessage` here — components must NOT toast success
 * again. Errors are handled by the caller (`showErrorToast: false`) so 409/400 can be mapped
 * to a precise message instead of the generic factory toast.
 */

import { createMutation } from "@/lib/api/query-factory";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closeShortPurchaseOrder,
  createPurchaseOrder,
  receiveGoods,
  sendPurchaseOrder,
} from "./api";
import { poDashboardKeys, poKeys, replenishmentKeys, supplierSpendKeys } from "./queries";

import type { CreatePoResult, ReceiveLineInput } from "./api";
import type { CreatePoInput } from "./schemas";
import type { PurchaseOrder } from "./types";

/** Every PO transition changes the list, the status dashboard and the spend report. */
const PO_INVALIDATE = [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all] as const;

export const useCreatePo = createMutation<CreatePoInput, CreatePoResult>(createPurchaseOrder, {
  invalidate: PO_INVALIDATE,
  showErrorToast: false,
});

export const useApprovePo = createMutation<{ id: string }, PurchaseOrder>(
  ({ id }) => approvePurchaseOrder(id),
  {
    invalidate: [...PO_INVALIDATE, replenishmentKeys.all],
    showErrorToast: false,
    successMessage: "Phê duyệt thành công",
  },
);

export const useSendPo = createMutation<{ id: string }, PurchaseOrder>(
  ({ id }) => sendPurchaseOrder(id),
  { invalidate: PO_INVALIDATE, showErrorToast: false, successMessage: "Đã gửi tới NCC" },
);

export const useCancelPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => cancelPurchaseOrder(id, reason),
  { invalidate: PO_INVALIDATE, showErrorToast: false, successMessage: "Đã huỷ PO" },
);

export const useCloseShortPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => closeShortPurchaseOrder(id, reason),
  { invalidate: PO_INVALIDATE, showErrorToast: false, successMessage: "Đã đóng thiếu" },
);

export const useReceiveGoodsPo = createMutation<
  { id: string; lines: ReceiveLineInput[] },
  PurchaseOrder
>(({ id, lines }) => receiveGoods(id, lines), {
  invalidate: PO_INVALIDATE,
  showErrorToast: false,
  successMessage: "Đã ghi nhận nhận hàng",
});
