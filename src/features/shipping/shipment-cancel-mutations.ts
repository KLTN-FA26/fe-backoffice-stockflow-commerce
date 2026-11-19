/** Shipping — mutation huỷ lô giao Sẵn sàng xuất: lô mới nhất vào cache; danh sách lô, chuyến và đơn được tải lại. */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { loadKeys, shipmentKeys } from "./queries";
import { cancelShipment } from "./shipment-cancel-api";

import type { CancelShipmentInput } from "./shipment-cancel-api";
import type { Shipment } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;

const useCancelShipmentBase = createMutation<CancelShipmentInput, Shipment>(cancelShipment, {
  invalidate: [shipmentKeys.all, loadKeys.all, ORDER_ROOT_KEY],
  successMessage: TOAST_MESSAGES.shipping.shipmentCancelled,
  // Hộp thoại hiện lỗi inline
  showErrorToast: false,
});

export function useCancelShipment(options?: Parameters<typeof useCancelShipmentBase>[0]) {
  const queryClient = useQueryClient();
  return useCancelShipmentBase({
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
