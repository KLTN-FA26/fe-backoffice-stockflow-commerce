/**
 * Trạng thái ô "Đặt xe" của phiếu xếp hàng (PR F6) — hàm thuần. Phiếu chỉ ghi "Chưa đặt xe" khi chuyến của xe đang
 * PLANNED (trạng thái này có sẵn trong chi tiết kế hoạch, không cần quyền đọc lô). Đang tải, lỗi hay thiếu quyền
 * `fulfillment-shipments:READ` thì hiện "—" kèm đúng lý do — không bao giờ khẳng định "chưa đặt" khi chưa biết.
 */

import { LOAD_STATUS } from "@/constants";

import type { LoadBooking } from "../print-booking";
import type { PlanVehicle } from "../plan-types";

export type BookingView =
  | { kind: "no-load" }
  | { kind: "not-booked" }
  | { kind: "cancelled" }
  | { kind: "no-permission" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "booked"; booking: LoadBooking };

type Load = PlanVehicle["load"];

/** Chỉ chuyến đã đặt xe / đang xếp / đã giao mới có hãng, biển số, tài xế để đọc. */
export function bookingNeedsFetch(load: Load, canReadLoads: boolean): boolean {
  return (
    canReadLoads &&
    !!load &&
    load.status !== LOAD_STATUS.PLANNED &&
    load.status !== LOAD_STATUS.CANCELLED
  );
}

export function bookingViewOf(input: {
  load: Load;
  canReadLoads: boolean;
  data: LoadBooking | undefined;
  isError: boolean;
}): BookingView {
  const { load, canReadLoads, data, isError } = input;
  if (!load) return { kind: "no-load" };
  if (load.status === LOAD_STATUS.PLANNED) return { kind: "not-booked" };
  if (load.status === LOAD_STATUS.CANCELLED) return { kind: "cancelled" };
  if (!canReadLoads) return { kind: "no-permission" };
  if (data) return { kind: "booked", booking: data };
  return isError ? { kind: "error" } : { kind: "loading" };
}

/** Nút in chỉ mở khi không còn gì đang tải: tờ in ra phải có đủ thông tin đặt xe (hoặc lý do vắng). */
export const bookingSettled = (view: BookingView): boolean => view.kind !== "loading";
