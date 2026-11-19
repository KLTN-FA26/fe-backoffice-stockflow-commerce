/**
 * Shipping — sửa lý do giao thất bại (BE `ShipmentController`):
 *   POST /fulfillment/shipments/{id}/failure-reason-correction {failureReason, note?, reason}
 *        (fulfillment-delivery-corrections:UPDATE) → Shipment
 * 409 SHIPMENT_STATE_CONFLICT (lô không thất bại / không hoàn), SHIPMENT_FAILURE_REASON_LOCKED (hàng hoàn đã nhập kho).
 */

import { api } from "@/lib/api/client";

import { SHIPMENTS_PATH } from "./shipment-api";
import { beShipmentSchema } from "./schemas";

import type { FailureReasonCorrectionValues } from "./failure-reason-schemas";
import type { Shipment } from "./types";

export interface CorrectFailureReasonInput {
  shipmentId: string;
  values: FailureReasonCorrectionValues;
}

export async function correctFailureReason({
  shipmentId,
  values,
}: CorrectFailureReasonInput): Promise<Shipment> {
  const { data } = await api.post<unknown>(
    `${SHIPMENTS_PATH}/${encodeURIComponent(shipmentId)}/failure-reason-correction`,
    values,
  );
  return beShipmentSchema.parse(data);
}
