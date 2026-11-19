/**
 * Shipping — API cấu hình hãng tích hợp API đặt xe (BE `CarrierController`, docs 09 §4.1), base `/fulfillment/carriers`:
 *
 *   GET /{id}/service-codes                 `fulfillment-shipments:READ`
 *   PUT /{id}/service-codes {codes}         `fulfillment-carriers:UPDATE`; thay CẢ danh sách; 409 CARRIER_NOT_API_BOOKING,
 *                                           404 VEHICLE_TYPE_NOT_FOUND
 *   GET /{id}/pickup-points                 `fulfillment-shipments:READ`
 *   PUT /{id}/pickup-points {pickupPoints}  `fulfillment-carriers:UPDATE`; thay CẢ danh sách của kho người dùng phụ trách
 *   GET /{id}/services?cityId=              `fulfillment-carriers:UPDATE`; HỎI API CỦA HÃNG (gọi ra ngoài); 422 / 502
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { CARRIERS_PATH } from "./carrier-api";
import {
  bePickupPointListSchema,
  beServiceCodeListSchema,
  beServiceOptionListSchema,
  beVehicleTypeOptionPageSchema,
} from "./carrier-config-schemas";

import type {
  PickupPointBody,
  PickupPointRecord,
  ServiceCodeBody,
  ServiceCodeRecord,
  ServiceOption,
  VehicleTypeOption,
} from "./carrier-config-schemas";

const carrierPath = (carrierId: string, tail: string) =>
  `${CARRIERS_PATH}/${encodeURIComponent(carrierId)}/${tail}`;

export async function listServiceCodes(
  carrierId: string,
  signal?: AbortSignal,
): Promise<ServiceCodeRecord[]> {
  const { data } = await api.get<unknown>(carrierPath(carrierId, "service-codes"), { signal });
  return beServiceCodeListSchema.parse(data);
}

export async function replaceServiceCodes(
  carrierId: string,
  codes: readonly ServiceCodeBody[],
): Promise<ServiceCodeRecord[]> {
  const { data } = await api.put<unknown>(carrierPath(carrierId, "service-codes"), { codes });
  return beServiceCodeListSchema.parse(data);
}

export async function listPickupPoints(
  carrierId: string,
  signal?: AbortSignal,
): Promise<PickupPointRecord[]> {
  const { data } = await api.get<unknown>(carrierPath(carrierId, "pickup-points"), { signal });
  return bePickupPointListSchema.parse(data);
}

export async function replacePickupPoints(
  carrierId: string,
  pickupPoints: readonly PickupPointBody[],
): Promise<PickupPointRecord[]> {
  const { data } = await api.put<unknown>(carrierPath(carrierId, "pickup-points"), {
    pickupPoints,
  });
  return bePickupPointListSchema.parse(data);
}

/** Dịch vụ xe tải của hãng ở một thành phố — BE hỏi API của hãng (gọi ra ngoài), chỉ gọi khi người dùng bấm tra. */
export async function listCarrierServices(
  carrierId: string,
  cityId: string,
  signal?: AbortSignal,
): Promise<ServiceOption[]> {
  const { data } = await api.get<unknown>(carrierPath(carrierId, "services"), {
    params: { cityId },
    signal,
  });
  return beServiceOptionListSchema.parse(data);
}

/**
 * Loại xe cho ô chọn mã dịch vụ — mọi trạng thái (một mã dịch vụ có thể trỏ loại xe đã ngừng dùng); cần
 * `fulfillment-vehicle-types:READ`. Không import feature loại xe (feature-architecture).
 */
export async function listVehicleTypeOptions(signal?: AbortSignal): Promise<VehicleTypeOption[]> {
  const { data } = await api.get<unknown>("/fulfillment/vehicle-types", {
    params: { page: 0, size: PAGE_SIZE.masterData },
    signal,
  });
  return beVehicleTypeOptionPageSchema.parse(data).items;
}
