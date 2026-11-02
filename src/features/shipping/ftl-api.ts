/**
 * Shipping — API chuyến nguyên xe (FTL, BE `DispatchController`, PR #162, SCRUM-392). Mọi endpoint cần
 * `fulfillment-dispatch:UPDATE` và kho trong phạm vi dữ liệu; kế hoạch xếp xe phải đã chốt.
 *
 *   POST /fulfillment/loads/{id}/booking              {carrierId, vehiclePlate?, driverName?, driverPhone?}
 *        PLANNED → VEHICLE_BOOKED (đặt lại khi còn VEHICLE_BOOKED = thay thông tin)
 *   POST /fulfillment/loads/{id}/booking-cancellation {reason}   → về PLANNED, chỉ trước LOADING
 *   POST /fulfillment/loads/{id}/loading-start        VEHICLE_BOOKED → LOADING (BR-14: kế hoạch không mở lại được)
 *   POST /fulfillment/loads/{id}/unloads              {packageCode}  → dỡ kiện của đơn đã huỷ khỏi xe
 * Quét kiện / bàn giao dùng lại endpoint của chuyến gửi kiện (`api.ts`).
 * Lỗi: 404 CARRIER_NOT_FOUND, PACKAGE_NOT_FOUND; 409 INVALID_LOAD_TRANSITION, INVALID_LOAD_PLAN_TRANSITION,
 * CARRIER_INACTIVE, SHIPMENT_OTHER_CARRIER, PACKAGE_NOT_IN_LOAD (xem `errors.ts`).
 */

import { api } from "@/lib/api/client";

import { loadPath } from "./api";
import { beLoadSchema } from "./load-schemas";

import type {
  BookLoadInput,
  CancelBookingInput,
  Load,
  StartLoadingInput,
  UnloadPackageInput,
} from "./types";

/** Đặt xe với hãng (bên ngoài hệ thống): ghi hãng, biển số, tài xế; chuyến sang VEHICLE_BOOKED. */
export async function bookLoad({ loadId, values }: BookLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/booking`, values);
  return beLoadSchema.parse(data);
}

/** Đặt xe không thành: chuyến về PLANNED, hãng / biển số / tài xế bị xoá, lý do được giữ lại. */
export async function cancelLoadBooking({ loadId, reason }: CancelBookingInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/booking-cancellation`, { reason });
  return beLoadSchema.parse(data);
}

/** Xe đã tới kho: VEHICLE_BOOKED → LOADING; từ đây kế hoạch không mở lại hay huỷ được (BR-14). */
export async function startLoading({ loadId }: StartLoadingInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/loading-start`);
  return beLoadSchema.parse(data);
}

/** Quét dỡ một kiện của đơn đã huỷ khỏi xe; hết kiện cần dỡ thì mới bàn giao được (LOAD_UNLOAD_PENDING). */
export async function unloadPackage({ loadId, packageCode }: UnloadPackageInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/unloads`, { packageCode });
  return beLoadSchema.parse(data);
}
