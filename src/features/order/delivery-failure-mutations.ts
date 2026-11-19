/**
 * Giao thất bại — mutation hooks (BE `DeliveryFailureController`, WF-05 GH-1).
 *
 * Giao lại: đơn rời trạng thái giữ, hàng về được giữ cho đơn (`RESERVATION_CHANGE_INVALIDATIONS`) chờ Quản lý kho release.
 * Huỷ phần chưa giao: đóng phần còn lại của đơn — nhả giữ chỗ, rút lô giao lại đã release khỏi kho
 * (`fulfillmentTasks`), tiền vượt thành số phải hoàn. Hồ sơ nằm dưới `orderKeys.all`. `showErrorToast: false`: hộp
 * thoại map lỗi theo `error.code` (`delivery-failure-errors.ts`).
 */

import { DELIVERY_FAILURE_LABELS, SHARED_QUERY_ROOTS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { cancelUndelivered, redeliverFailedShipment } from "./delivery-failure-api";
import { orderKeys } from "./queries";

import type { CancelUndeliveredInput, RedeliverInput } from "./delivery-failure-api";
import type { DeliveryFailureCase } from "./delivery-failure-schemas";

export const useRedeliverFailedShipment = createMutation<RedeliverInput, DeliveryFailureCase>(
  redeliverFailedShipment,
  {
    invalidate: [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS],
    successMessage: DELIVERY_FAILURE_LABELS.redeliver.success,
    showErrorToast: false,
  },
);

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
