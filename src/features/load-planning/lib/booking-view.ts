/**
 * Trạng thái ô "Đặt xe" của phiếu xếp hàng (PR F6) — hàm thuần. Phiếu chỉ ghi "Chưa đặt xe" khi chuyến của xe đang
 * PLANNED (trạng thái này có sẵn trong chi tiết kế hoạch, không cần quyền đọc lô). Đang tải, lỗi hay thiếu quyền
 * `fulfillment-shipments:READ` thì hiện "—" kèm đúng lý do — không bao giờ khẳng định "chưa đặt" khi chưa biết.
 */

import { LOAD_STATUS } from "@/constants";

import type { PlanVehicle } from "../plan-types";
import type { LoadBooking } from "../print-booking";

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

type WarehouseEntry = { warehouseId: string; code: string; name: string };

/**
 * Kho xuất in trên phiếu: tên kho do chuyến trả về (người xem có quyền đọc lô); chưa có thì tra danh mục kho theo id kế
 * hoạch (danh mục có thể 403 với tài khoản không có quyền kho). Không tra được thì null — phiếu ghi "—", không bao giờ in
 * id thô.
 */
export function warehouseLabelOf(
  booking: LoadBooking | null,
  directory: readonly WarehouseEntry[] | undefined,
  warehouseId: string,
): string | null {
  if (booking?.warehouseName) return booking.warehouseName;
  const entry = directory?.find((w) => w.warehouseId === warehouseId);
  if (!entry) return null;
  return entry.code ? `${entry.code} · ${entry.name}` : entry.name;
}

/** Nút in chỉ mở khi không còn gì đang tải: tờ in ra phải có đủ thông tin đặt xe (hoặc lý do vắng). */
export const bookingSettled = (view: BookingView): boolean => view.kind !== "loading";
