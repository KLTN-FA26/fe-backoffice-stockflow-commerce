/**
 * Shipping — API lô giao (BE `ShipmentController`). Hãng vận chuyển ở `carrier-api.ts`.
 *
 *   GET /fulfillment/shipments?warehouseId&status&carrierId&orderId&search&page&size
 *   GET /fulfillment/shipments/{id}                 → Shipment (kiện + lịch sử)
 *   POST /fulfillment/shipments/{id}/delivery-outcome {outcome, failureReason?, note?}
 *        (fulfillment-delivery-outcomes:UPDATE; ĐÃ GIAO / GIAO THẤT BẠI cần thêm :APPROVE)
 * Không còn `PUT /shipments/{id}/carrier`: hãng gắn vào xe khi ghi nhận đặt xe, không gắn vào từng lô.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beShipmentPageSchema, beShipmentSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { RecordOutcomeInput, Shipment, ShipmentRow } from "./types";

export const SHIPMENTS_PATH = "/fulfillment/shipments";
const shipmentPath = (id: string) => `${SHIPMENTS_PATH}/${encodeURIComponent(id)}`;

export interface ListShipmentParams extends ListQueryParams {
  page?: number;
  size?: number;
  warehouseId?: string;
  /** BE nhận MỘT trạng thái (READY_TO_DISPATCH, HANDED_OVER, DELIVERED, DELIVERY_FAILED, RETURNED, CANCELLED). */
  status?: string;
  carrierId?: string;
  orderId?: string;
  /** So khớp mã lô giao. */
  search?: string;
}

export async function listShipments(
  params: ListShipmentParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ShipmentRow>> {
  const { data } = await api.get<unknown>(SHIPMENTS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      warehouseId: params.warehouseId || undefined,
      status: params.status || undefined,
      carrierId: params.carrierId || undefined,
      orderId: params.orderId || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return beShipmentPageSchema.parse(data);
}

export async function getShipment(id: string, signal?: AbortSignal): Promise<Shipment> {
  const { data } = await api.get<unknown>(shipmentPath(id), { signal });
  return beShipmentSchema.parse(data);
}

/** Ghi nhận kết quả hãng báo lại (docs 09 §4.3). Cùng kết quả gửi lại → không đổi gì. */
export async function recordDeliveryOutcome({
  shipmentId,
  values,
}: RecordOutcomeInput): Promise<Shipment> {
  const { data } = await api.post<unknown>(`${shipmentPath(shipmentId)}/delivery-outcome`, values);
  return beShipmentSchema.parse(data);
}
