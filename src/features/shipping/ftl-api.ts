/**
 * Shipping — API chuyến nguyên xe (FTL, BE `DispatchController`, PR #162, SCRUM-392). Mọi endpoint cần
 * `fulfillment-dispatch:UPDATE` và kho trong phạm vi dữ liệu; kế hoạch xếp xe phải đã chốt.
 *
 *   POST /fulfillment/loads/{id}/booking              {carrierId, vehiclePlate?, driverName?, driverPhone?}
 *        PLANNED → VEHICLE_BOOKED (đặt lại khi còn VEHICLE_BOOKED = thay thông tin)
 *   PUT  /fulfillment/loads/{id}/driver               {driverName, driverPhone?}   WF4-DRIVER (BE PR #316)
 *        chuyến VEHICLE_BOOKED / LOADING, mọi hãng (kể cả hãng đặt xe qua API); chỉ tài xế, không đụng mã vận đơn;
 *        409 INVALID_LOAD_TRANSITION (chưa đặt xe / đã huỷ / xe đã rời kho); 400 VALIDATION_FAILED (tên trống)
 *   POST /fulfillment/loads/{id}/booking-cancellation {reason}   → về PLANNED, chỉ trước LOADING
 *   POST /fulfillment/loads/{id}/loading-start        VEHICLE_BOOKED → LOADING (BR-14: kế hoạch không mở lại được)
 *   POST /fulfillment/loads/{id}/unloads              {packageCode}  → dỡ kiện khỏi xe (đơn đã huỷ, hoặc xe huỷ có kiểm soát)
 *   POST /fulfillment/loads/{id}/controlled-cancellation {reasonCode, note, removedShipmentIds?}   SCRUM-474, quyền
 *        riêng của quản lý kho → {cancelled, replacement}: xe đang xếp huỷ ngay, kiện bị khoá tới khi dỡ, chuyến thay thế
 *        PLANNED cùng sơ đồ — hoặc sơ đồ tính lại khi có lô gỡ khỏi xe (docs 09 §4.2 bước 9); gỡ hết thì không có chuyến
 *   POST /fulfillment/loads/{id}/unload-overrides     {packageId, note?}  → xác nhận dỡ kiện không quét (nhãn hỏng), quyền như trên
 * Quét kiện / bàn giao dùng lại endpoint của chuyến gửi kiện (`api.ts`).
 * Lỗi: 404 CARRIER_NOT_FOUND, PACKAGE_NOT_FOUND; 409 INVALID_LOAD_TRANSITION, INVALID_LOAD_PLAN_TRANSITION,
 * CARRIER_INACTIVE, SHIPMENT_OTHER_CARRIER, PACKAGE_NOT_IN_LOAD (xem `errors.ts`).
 */

import { api } from "@/lib/api/client";

import { loadPath } from "./api";
import { beControlledCancelSchema, beLoadSchema } from "./load-schemas";

import type {
  BookLoadInput,
  CancelBookingInput,
  ControlledCancelLoadInput,
  ControlledCancelResult,
  Load,
  OverrideUnloadInput,
  RecordDriverInput,
  StartLoadingInput,
  UnloadPackageInput,
} from "./types";

/** Đặt xe với hãng (bên ngoài hệ thống): ghi hãng, biển số, tài xế; chuyến sang VEHICLE_BOOKED. */
export async function bookLoad({ loadId, values }: BookLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/booking`, values);
  return beLoadSchema.parse(data);
}

/** Nhập tài xế của xe đã đặt / đang xếp (BE `PUT loads/{id}/driver`): chỉ tên + SĐT tài xế, không đụng mã vận đơn. */
export async function recordDriver({ loadId, values }: RecordDriverInput): Promise<Load> {
  const { data } = await api.put<unknown>(`${loadPath(loadId)}/driver`, values);
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

/**
 * Huỷ có kiểm soát MỘT xe đang xếp hàng (SCRUM-474 UNLOAD-DESIGN, docs 09 BR-14): chuyến huỷ ngay kèm mã lý do + ghi chú, kiện đã
 * quét bị khoá tới khi dỡ, và một chuyến PLANNED cùng sơ đồ xếp thay thế để đặt xe khác. Kế hoạch và các xe khác vẫn đi tiếp.
 */
export async function cancelLoadControlled({
  loadId,
  reasonCode,
  note,
  removedShipmentIds,
}: ControlledCancelLoadInput): Promise<ControlledCancelResult> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/controlled-cancellation`, {
    reasonCode,
    note: note.trim(),
    // Docs 09 §4.2 bước 9: lô gỡ khỏi xe bị loại khỏi kế hoạch, chuyến mới tính lại sơ đồ; không gửi = cùng sơ đồ
    ...(removedShipmentIds?.length ? { removedShipmentIds } : {}),
  });
  const parsed = beControlledCancelSchema.parse(data);
  return { cancelled: parsed.cancelled, replacement: parsed.replacement ?? null };
}

/** Xác nhận dỡ một kiện KHÔNG cần quét vì nhãn hỏng — chỉ quản lý kho; BE ghi người, thời điểm và ghi chú. */
export async function overrideUnload({
  loadId,
  packageId,
  note,
}: OverrideUnloadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/unload-overrides`, {
    packageId,
    note: note?.trim() || undefined,
  });
  return beLoadSchema.parse(data);
}
