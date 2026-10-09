/**
 * Purchase Order — mutation hooks, mỗi hook một endpoint BE.
 *
 * Toast thành công đến từ `successMessage` — component KHÔNG toast lần nữa. Lỗi do nơi gọi
 * xử lý (`showErrorToast: false`) để map `errorCode` sang câu tiếng Việt (`errors.ts`).
 * Gửi NCC / khôi phục không có successMessage: kết quả giao thật nằm ở `deliveryStatus`.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closeShortPurchaseOrder,
  createPurchaseOrder,
  recordSupplierConfirmation,
  recoverPoDelivery,
  sendPurchaseOrder,
} from "./api";
import { poDashboardKeys, poDeliveryKeys, poKeys, supplierSpendKeys } from "./queries";

import type { CreatePoResult } from "./api";
import type {
  CreatePoInput,
  RecoverDeliveryInput,
  SendPoInput,
  SupplierConfirmationInput,
} from "./schemas";
import type { PurchaseOrder } from "./types";

const MSG = TOAST_MESSAGES.purchaseOrder;
/** Mọi chuyển trạng thái PO đổi danh sách, dashboard trạng thái và báo cáo chi tiêu. */
const PO_INVALIDATE = [poKeys.all, poDashboardKeys.all, supplierSpendKeys.all] as const;
const DELIVERY_INVALIDATE = [poKeys.all, poDeliveryKeys.all] as const;

export const useCreatePo = createMutation<CreatePoInput, CreatePoResult>(createPurchaseOrder, {
  invalidate: PO_INVALIDATE,
  showErrorToast: false,
});

export const useApprovePo = createMutation<{ id: string }, PurchaseOrder>(
  ({ id }) => approvePurchaseOrder(id),
  { invalidate: PO_INVALIDATE, showErrorToast: false, successMessage: MSG.approved },
);

export const useSendPo = createMutation<{ id: string; input: SendPoInput }, PurchaseOrder>(
  ({ id, input }) => sendPurchaseOrder(id, input),
  { invalidate: [...PO_INVALIDATE, poDeliveryKeys.all], showErrorToast: false },
);

export const useCancelPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => cancelPurchaseOrder(id, reason),
  // BE #36: huỷ PO đã gửi → chặn lần gửi đang chờ + xếp thư báo huỷ → bảng lần gửi đổi.
  {
    invalidate: [...PO_INVALIDATE, poDeliveryKeys.all],
    showErrorToast: false,
    successMessage: MSG.cancelled,
  },
);

export const useCloseShortPo = createMutation<{ id: string; reason: string }, PurchaseOrder>(
  ({ id, reason }) => closeShortPurchaseOrder(id, reason),
  { invalidate: PO_INVALIDATE, showErrorToast: false, successMessage: MSG.closedShort },
);

export const useRecoverPoDelivery = createMutation<
  { id: string; input: RecoverDeliveryInput },
  PurchaseOrder
>(({ id, input }) => recoverPoDelivery(id, input), {
  invalidate: DELIVERY_INVALIDATE,
  showErrorToast: false,
  successMessage: MSG.deliveryRecovered,
});

export const useRecordSupplierConfirmation = createMutation<
  { id: string; input: SupplierConfirmationInput },
  PurchaseOrder
>(({ id, input }) => recordSupplierConfirmation(id, input), {
  // BE `suppressSupplierDelivery`: NCC đã phản hồi → lần gửi đang chờ bị chặn (SUPPRESSED).
  invalidate: DELIVERY_INVALIDATE,
  showErrorToast: false,
  successMessage: MSG.confirmationRecorded,
});
