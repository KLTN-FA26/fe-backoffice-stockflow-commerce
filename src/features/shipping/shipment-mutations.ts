/**
 * Shipping — mutations lô giao: chọn hãng, ghi nhận kết quả giao. Response là lô mới nhất → ghi vào
 * cache chi tiết; danh sách lô, chuyến (trạng thái lô trên chuyến) và đơn hàng (BR-05) được tải lại.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { assignCarrier, recordDeliveryOutcome } from "./shipment-api";
import { isStaleLoadError, shippingErrorMessage } from "./errors";
import { loadKeys, shipmentKeys } from "./queries";

import type { AssignCarrierInput, RecordOutcomeInput, Shipment } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;
const T = TOAST_MESSAGES.shipping;

function withShipmentCache<TInput extends { shipmentId: string }>(
  useBase: ReturnType<typeof createMutation<TInput, Shipment>>,
) {
  return function useWithShipmentCache(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onSuccess: (shipment, ...rest) => {
        queryClient.setQueryData<Shipment>(
          shipmentKeys.detail(shipment.shipment.shipmentId),
          shipment,
        );
        options?.onSuccess?.(shipment, ...rest);
      },
      onError: (...args) => {
        // Lô đã đổi ở nơi khác (người khác bàn giao / ghi kết quả trước) → tải lại để thấy đúng
        if (isStaleLoadError(args[0])) {
          void queryClient.invalidateQueries({ queryKey: shipmentKeys.all });
          void queryClient.invalidateQueries({ queryKey: loadKeys.all });
        }
        options?.onError?.(...args);
      },
    });
  };
}

export const useAssignCarrier = withShipmentCache(
  createMutation<AssignCarrierInput, Shipment>(assignCarrier, {
    invalidate: [[...shipmentKeys.all, "list"]],
    showErrorToast: false,
    onSuccess: (shipment) =>
      toast.success(shipment.shipment.carrierId ? T.carrierSaved : T.carrierCleared),
    onError: (error) => toast.error(shippingErrorMessage(error)),
  }),
);

export const useRecordDeliveryOutcome = withShipmentCache(
  createMutation<RecordOutcomeInput, Shipment>(recordDeliveryOutcome, {
    invalidate: [shipmentKeys.all, loadKeys.all, ORDER_ROOT_KEY],
    successMessage: T.outcomeRecorded,
    // Dialog kết quả giao hiện lỗi inline
    showErrorToast: false,
  }),
);
