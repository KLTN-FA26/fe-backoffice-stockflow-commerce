/**
 * Shipping — API lô giao + hãng vận chuyển (BE `ShipmentController`, `CarrierController`, PR #137).
 *
 *   GET /fulfillment/carriers?status&search&page&size
 *   GET /fulfillment/shipments?warehouseId&status&carrierId&orderId&search&page&size
 *   GET /fulfillment/shipments/{id}                 → Shipment (kiện + lịch sử)
 *   PUT /fulfillment/shipments/{id}/carrier {carrierId}   (null = bỏ hãng; nhân viên kho)
 *   POST /fulfillment/shipments/{id}/delivery-outcome {outcome, failureReason?, note?}
 *        (Điều phối đơn hàng; HÀNG HOÀN về kho cả quản lý kho — BE `@PreAuthorize` + kiểm vai trò)
 * Nhãn kiện in lại dùng endpoint nhãn của trạm đóng gói (ghi nhận lần in) — xem `errors.ts` LABEL_OUTDATED.
 */

import { CARRIER_STATUSES, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beCarrierPageSchema, beShipmentPageSchema, beShipmentSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AssignCarrierInput,
  Carrier,
  RecordOutcomeInput,
  Shipment,
  ShipmentRow,
} from "./types";

const CARRIERS_PATH = "/fulfillment/carriers";
export const SHIPMENTS_PATH = "/fulfillment/shipments";
const shipmentPath = (id: string) => `${SHIPMENTS_PATH}/${encodeURIComponent(id)}`;

export interface ListCarrierParams extends ListQueryParams {
  status?: (typeof CARRIER_STATUSES)[number];
  search?: string;
}

/** Hãng trong danh mục — chọn hãng cho lô / chuyến chỉ lấy hãng ACTIVE. */
export async function listCarriers(
  params: ListCarrierParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Carrier>> {
  const { data } = await api.get<unknown>(CARRIERS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.masterData,
      status: params.status || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return beCarrierPageSchema.parse(data);
}

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

/** Chọn hãng cho lô chờ xuất (docs 09 §4.1 bước 2: gom theo hãng); `null` bỏ hãng. Lô trên chuyến → 409. */
export async function assignCarrier({
  shipmentId,
  carrierId,
}: AssignCarrierInput): Promise<Shipment> {
  const { data } = await api.put<unknown>(`${shipmentPath(shipmentId)}/carrier`, { carrierId });
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
