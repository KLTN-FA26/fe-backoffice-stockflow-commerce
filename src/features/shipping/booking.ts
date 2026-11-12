/**
 * Shipping — dựng thân yêu cầu đặt xe (BE `POST loads/{id}/booking`, docs 09 §4.2 bước 6, BR-29) và sắp thứ tự điểm giao.
 * Pure — không gọi mạng.
 */

import { CARRIER_CONNECTION_TYPE } from "@/constants";

import type { CarrierConnectionType } from "@/constants";
import type { BookingRequestBody, BookingValues } from "./types";

/** Hãng đặt xe qua API: hệ thống tạo đơn ở hãng, không nhập tay biển số / tài xế / mã vận đơn (BE 400 nếu gửi). */
export function isApiBooking(type: CarrierConnectionType | "UNKNOWN" | null | undefined): boolean {
  return type === CARRIER_CONNECTION_TYPE.API_BOOKING;
}

/**
 * Giờ hẹn lấy hàng từ ô `datetime-local` (`yyyy-MM-ddTHH:mm`, giờ Việt Nam UTC+7 — docs: múi giờ Asia/Ho_Chi_Minh) →
 * Instant ISO UTC của BE. Rỗng / sai dạng → `undefined` (BE hiểu là càng sớm càng tốt).
 */
export function pickupInstant(local: string | undefined): string | undefined {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return undefined;
  const at = new Date(`${local}:00+07:00`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

/**
 * Thân yêu cầu đặt xe. Hãng API: chỉ hãng + giờ hẹn + thứ tự điểm giao (E26: đúng các lô trên biên bản). Hãng thường: hãng +
 * biển số / tài xế / SĐT / mã vận đơn nếu đã có. `stops` rỗng → để BE dùng thứ tự biên bản.
 */
export function bookingRequestBody(
  values: BookingValues,
  apiBooking: boolean,
  stops: readonly string[],
): BookingRequestBody {
  if (apiBooking) {
    return {
      carrierId: values.carrierId,
      pickupAt: pickupInstant(values.pickupAt),
      stopShipmentIds: stops.length > 0 ? [...stops] : undefined,
    };
  }
  return {
    carrierId: values.carrierId,
    vehiclePlate: values.vehiclePlate,
    driverName: values.driverName,
    driverPhone: values.driverPhone,
    waybillNo: values.waybillNo,
  };
}

/** Đổi chỗ điểm giao `index` với điểm kề (`delta` -1 = lên, +1 = xuống); ngoài biên thì giữ nguyên. */
export function moveStop(order: readonly string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  const next = [...order];
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  const moved = next[index];
  const other = next[target];
  if (moved === undefined || other === undefined) return next;
  next[index] = other;
  next[target] = moved;
  return next;
}
