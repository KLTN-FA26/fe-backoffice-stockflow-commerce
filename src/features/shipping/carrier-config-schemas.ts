/**
 * Shipping — DTO cấu hình hãng tích hợp API đặt xe (BE `CarrierServiceCodeResponse`, `CarrierPickupPointsRequest.Point`,
 * `CarrierServiceOptionResponse`; docs 09 §4.1). BE bỏ field null khỏi JSON nên field tuỳ chọn khai `.nullish()`.
 */

import { z } from "zod";

/** Một mã dịch vụ của hãng theo loại xe và tỉnh / thành. */
export const beServiceCodeSchema = z.object({
  vehicleTypeId: z.string(),
  vehicleTypeCode: z.string().nullish(),
  provinceCode: z.string(),
  carrierCityCode: z.string(),
  serviceCode: z.string(),
});
export const beServiceCodeListSchema = z.array(beServiceCodeSchema);

/** Điểm lấy hàng của hãng ở một kho. */
export const bePickupPointSchema = z.object({
  warehouseId: z.string(),
  provinceCode: z.string(),
  address: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
});
export const bePickupPointListSchema = z.array(bePickupPointSchema);

/** Dịch vụ xe tải mà hãng bán ở một thành phố (hãng tự đặt tên). */
export const beServiceOptionSchema = z.object({
  serviceCode: z.string(),
  name: z.string().nullish(),
  cityId: z.string().nullish(),
});
export const beServiceOptionListSchema = z.array(beServiceOptionSchema);

/** Loại xe cho ô chọn (`GET /fulfillment/vehicle-types`): chỉ trường màn dùng — không import feature loại xe. */
export const beVehicleTypeOptionSchema = z.object({
  vehicleTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.string().nullish(),
});
export const beVehicleTypeOptionPageSchema = z.object({
  items: z.array(beVehicleTypeOptionSchema),
});

export type VehicleTypeOption = z.infer<typeof beVehicleTypeOptionSchema>;
export type ServiceCodeRecord = z.infer<typeof beServiceCodeSchema>;
export type PickupPointRecord = z.infer<typeof bePickupPointSchema>;
export type ServiceOption = z.infer<typeof beServiceOptionSchema>;

/** Thân `PUT /carriers/{id}/service-codes` (lớp Input). */
export const serviceCodeBodySchema = z.object({
  vehicleTypeId: z.string(),
  provinceCode: z.string(),
  carrierCityCode: z.string(),
  serviceCode: z.string(),
});
export type ServiceCodeBody = z.infer<typeof serviceCodeBodySchema>;

/** Thân `PUT /carriers/{id}/pickup-points` (lớp Input). */
export const pickupPointBodySchema = z.object({
  warehouseId: z.string(),
  provinceCode: z.string(),
  address: z.string(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});
export type PickupPointBody = z.infer<typeof pickupPointBodySchema>;
