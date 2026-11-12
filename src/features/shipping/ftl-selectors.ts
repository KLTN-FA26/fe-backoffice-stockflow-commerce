/**
 * Shipping — selector thuần cho chuyến xe (một xe của kế hoạch xếp xe): kiện cần dỡ, huỷ sau khi đã đặt xe, mã vận đơn.
 */

import { LOAD_STATUS } from "@/constants";

import { isApiBooking } from "./booking";

import type { Load, PendingUnload } from "./types";

/** Kiện của đơn đã huỷ còn trên xe (BE `pendingUnloads`; vắng = không có). */
export function pendingUnloadsOf(load: Pick<Load, "pendingUnloads">): readonly PendingUnload[] {
  return load.pendingUnloads ?? [];
}

/** Còn kiện phải dỡ → BE 409 LOAD_UNLOAD_PENDING khi bàn giao. */
export function hasPendingUnloads(load: Pick<Load, "pendingUnloads">): boolean {
  return pendingUnloadsOf(load).length > 0;
}

/** Chuyến đã huỷ nhưng xe vẫn còn đặt ở ngoài hệ thống → nhắc điều phối huỷ với nhà xe. */
export function needsCarrierBookingCancel(
  load: Pick<Load, "status" | "carrierBookingToCancel">,
): boolean {
  return load.status === LOAD_STATUS.CANCELLED && load.carrierBookingToCancel === true;
}

/** BE gọi huỷ tự động khi xe không còn gì để chở: lý do bắt đầu bằng "auto-cancelled". */
export function isAutoCancelled(load: Pick<Load, "cancelReason">): boolean {
  return (load.cancelReason ?? "").toLowerCase().startsWith("auto-cancelled");
}

/** Chuyến đặt qua API hãng (BR-29): mã vận đơn do hãng cấp, không nhập tay; đặt lại phải huỷ đặt xe trước. */
export function isApiBookedLoad(load: Pick<Load, "carrierConnectionType">): boolean {
  return isApiBooking(load.carrierConnectionType);
}

/** Chuyến đã có mã vận đơn (BR-23: bắt buộc trước khi ký bàn giao). */
export function hasWaybill(load: Pick<Load, "waybillNo">): boolean {
  return !!load.waybillNo;
}
