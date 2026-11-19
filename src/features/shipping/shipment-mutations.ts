/**
 * Shipping — mutations lô giao: ghi nhận và sửa tay kết quả giao. Response là lô mới nhất → ghi vào
 * cache chi tiết; danh sách lô, chuyến (trạng thái lô trên chuyến) và đơn hàng (BR-05) được tải lại.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { correctDeliveryOutcome, recordDeliveryOutcome } from "./shipment-api";
import { isStaleLoadError } from "./errors";
import { loadKeys, shipmentKeys } from "./queries";

import type { CorrectOutcomeInput } from "./correction-schemas";
import type { RecordOutcomeInput, Shipment } from "./types";

/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;
/** = `einvoiceKeys.all` / `installmentKeys.all` — ghi nhận / sửa kết quả giao đổi hoá đơn nháp và hạn các đợt sau giao (docs 09 §4.3). */
const EINVOICE_ROOT_KEY = ["einvoices"] as const;
const INSTALLMENT_ROOT_KEY = ["payment-installments"] as const;
const DELIVERY_FOLLOWERS = [ORDER_ROOT_KEY, EINVOICE_ROOT_KEY, INSTALLMENT_ROOT_KEY] as const;
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

export const useRecordDeliveryOutcome = withShipmentCache(
  createMutation<RecordOutcomeInput, Shipment>(recordDeliveryOutcome, {
    invalidate: [shipmentKeys.all, loadKeys.all, ...DELIVERY_FOLLOWERS],
    successMessage: T.outcomeRecorded,
    // Dialog kết quả giao hiện lỗi inline
    showErrorToast: false,
  }),
);

/** Sửa tay kết quả giao: đơn đi theo, hoá đơn nháp của lô cũng đổi nên tải lại cả đơn. */
export const useCorrectDeliveryOutcome = withShipmentCache(
  createMutation<CorrectOutcomeInput, Shipment>(correctDeliveryOutcome, {
    invalidate: [shipmentKeys.all, loadKeys.all, ...DELIVERY_FOLLOWERS],
    successMessage: T.outcomeCorrected,
    // Dialog sửa hiện lỗi inline
    showErrorToast: false,
  }),
);
