/**
 * Shipping — selector thuần cho chuyến xe (một xe của kế hoạch xếp xe): kiện cần dỡ, huỷ sau khi đã đặt xe, mã vận đơn.
 */

import { LOAD_STATUS } from "@/constants";

import { isApiBooking } from "./booking";

import type { Load, LoadRow, PendingUnload } from "./types";

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

/**
 * Hãng được dùng gần nhất của một kho: hãng của chuyến đã bàn giao muộn nhất trong các chuyến đưa vào (S17-3 — hãng dùng
 * gần nhất lên đầu ô chọn). Chuyến chưa bàn giao / chưa có hãng bỏ qua; không có thì `null`.
 */
export function latestCarrierId(
  loads: readonly Pick<LoadRow, "carrierId" | "dispatchedAt">[],
): string | null {
  let best: { id: string; at: number } | null = null;
  for (const row of loads) {
    const at = row.dispatchedAt ? Date.parse(row.dispatchedAt) : Number.NaN;
    if (!row.carrierId || Number.isNaN(at)) continue;
    if (!best || at > best.at) best = { id: row.carrierId, at };
  }
  return best?.id ?? null;
}

/** Thứ tự hiển thị danh sách chuyến mặc định "Tất cả": chuyến đang xử lý lên đầu, đã bàn giao sau, đã huỷ cuối. */
const LOAD_LIST_RANK: Record<string, number> = {
  LOADING: 0,
  VEHICLE_BOOKED: 1,
  PLANNED: 2,
  DISPATCHED: 3,
  CANCELLED: 4,
};

/**
 * Sắp các chuyến của MỘT TRANG: đang xử lý (đang xếp, đã đặt xe, chưa đặt) trước, rồi đã bàn giao, đã huỷ cuối; trong
 * cùng nhóm giữ thứ tự BE gửi. Chỉ trong trang đang xem — BE sắp thứ tự các trang. Lọc theo một trạng thái thì không đổi gì.
 */
export function inProgressFirst<T extends Pick<LoadRow, "status">>(rows: readonly T[]): T[] {
  const rank = (row: T) => LOAD_LIST_RANK[row.status] ?? LOAD_LIST_RANK.CANCELLED ?? 4;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}
