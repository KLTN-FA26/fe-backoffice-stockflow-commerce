/**
 * Shipping — QLK huỷ lô giao Sẵn sàng xuất (BE `ShipmentController`, docs 09 §5.1; RTM-RTDCANCEL 19/11):
 *   POST /fulfillment/shipments/{id}/cancellation {reason, damagedPackageIds}
 *        (fulfillment-shipment-cancellations:UPDATE) → Shipment
 * Thùng hư vào cách ly, thùng tốt vào hàng chờ cất lại; đơn tạm giữ (thiếu hàng) chờ phân bổ thùng khác.
 */

import { z } from "zod";

import { SHIPPING_FIELD_MESSAGES as MSG, SHIPPING_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";

import { SHIPMENTS_PATH } from "./shipment-api";
import { beShipmentSchema } from "./schemas";

import type { Shipment } from "./types";

export const shipmentCancelInputSchema = z.object({
  reason: z.string().trim().min(1, MSG.required).max(SHIPPING_LIMITS.cancelReasonMax, MSG.tooLong),
  damagedPackageIds: z.array(z.string()),
});

export type ShipmentCancelValues = z.output<typeof shipmentCancelInputSchema>;

export interface CancelShipmentInput {
  shipmentId: string;
  values: ShipmentCancelValues;
}

export async function cancelShipment({
  shipmentId,
  values,
}: CancelShipmentInput): Promise<Shipment> {
  const { data } = await api.post<unknown>(
    `${SHIPMENTS_PATH}/${encodeURIComponent(shipmentId)}/cancellation`,
    values,
  );
  return beShipmentSchema.parse(data);
}
