/**
 * Lô hàng hoàn về — mutation hooks (BE `DeliveryFailureController`, WF-05 GH-1 / BO-01; đóng phần thất lạc Q-12).
 *
 * Huỷ phần chưa giao (đơn cũ): đóng phần còn lại của đơn — nhả giữ chỗ, rút lô giao lại đã release khỏi kho
 * (`fulfillmentTasks`), tiền vượt thành số phải hoàn. Đóng phần thất lạc: đóng phần hàng của lô, tiền tính ngay (các đợt
 * thanh toán của đơn nằm dưới `orderKeys.all`). `showErrorToast: false`: hộp thoại map lỗi theo `error.code`
 * (`delivery-failure-errors.ts`).
 */

import {
  DELIVERY_FAILURE_LABELS,
  LOST_SHIPMENT_CLOSURE_LABELS,
  SHARED_QUERY_ROOTS,
} from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { cancelUndelivered } from "./delivery-failure-api";
import { closeLostShipment } from "./lost-closure-api";
import { orderKeys } from "./queries";

import type { CancelUndeliveredInput } from "./delivery-failure-api";
import type { DeliveryFailureCase } from "./delivery-failure-schemas";
import type { LostClosureInput } from "./lost-closure-api";
import type { Order } from "./types";

export const useCancelUndelivered = createMutation<CancelUndeliveredInput, DeliveryFailureCase[]>(
  cancelUndelivered,
  {
    invalidate: [
      orderKeys.all,
      ...RESERVATION_CHANGE_INVALIDATIONS,
      [SHARED_QUERY_ROOTS.fulfillmentTasks],
    ],
    successMessage: DELIVERY_FAILURE_LABELS.cancel.success,
    showErrorToast: false,
  },
);

export const useCloseLostShipment = createMutation<LostClosureInput, Order>(closeLostShipment, {
  invalidate: [orderKeys.all],
  successMessage: LOST_SHIPMENT_CLOSURE_LABELS.success,
  showErrorToast: false,
});
