/**
 * Shipping — mutation sửa lý do giao thất bại. Response là lô mới nhất → ghi vào cache chi tiết; danh sách lô và đơn
 * (lý do thất bại của lô trên đơn) được tải lại.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { correctFailureReason } from "./failure-reason-api";
import { shipmentKeys } from "./queries";

import type { CorrectFailureReasonInput } from "./failure-reason-api";
import type { Shipment } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;

const useCorrectFailureReasonBase = createMutation<CorrectFailureReasonInput, Shipment>(
  correctFailureReason,
  {
    invalidate: [shipmentKeys.all, ORDER_ROOT_KEY],
    successMessage: TOAST_MESSAGES.shipping.failureReasonCorrected,
    // Hộp thoại hiện lỗi inline
    showErrorToast: false,
  },
);

export function useCorrectFailureReason(
  options?: Parameters<typeof useCorrectFailureReasonBase>[0],
) {
  const queryClient = useQueryClient();
  return useCorrectFailureReasonBase({
    ...options,
    onSuccess: (shipment, ...rest) => {
      queryClient.setQueryData<Shipment>(
        shipmentKeys.detail(shipment.shipment.shipmentId),
        shipment,
      );
      options?.onSuccess?.(shipment, ...rest);
    },
  });
}
