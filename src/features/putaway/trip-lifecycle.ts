/**
 * Vòng đời chuyến cất hàng + gate thao tác (feature-architecture §6).
 *
 * Bảng chép từ docs 05 §5: Loading → In Progress (cần ≥ 1 thùng) / Closed (bỏ chuyến); In Progress → Completed (cất
 * hết) / Closed (đóng sớm); Completed và Closed là cuối. Chỗ giữ hết hạn không đổi trạng thái chuyến (BR-16).
 */

import { PUTAWAY_TRIP_PERMISSIONS, PUTAWAY_TRIP_STATUS as S } from "@/constants";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { PutawayTrip, PutawayTripStatus } from "./types";

export const PUTAWAY_TRIP_TRANSITIONS: Record<PutawayTripStatus, readonly PutawayTripStatus[]> = {
  [S.LOADING]: [S.IN_PROGRESS, S.CLOSED],
  [S.IN_PROGRESS]: [S.COMPLETED, S.CLOSED],
  [S.COMPLETED]: [],
  [S.CLOSED]: [],
};

export const isTripOpen = (status: PutawayTripStatus) =>
  PUTAWAY_TRIP_TRANSITIONS[status].length > 0;

export interface TripActions {
  /** Xếp / bỏ thùng (LOADING, chủ chuyến). */
  load: boolean;
  /** Bắt đầu đi — có thể bị khoá vì xe rỗng (`departBlocked`). */
  depart: boolean;
  departBlocked: boolean;
  /** Đặt thùng + đổi bin (IN_PROGRESS, chủ chuyến). */
  place: boolean;
  /** Đóng chuyến của mình. */
  close: boolean;
  /** Quản lý kho đóng chuyến của người khác (docs 05 §2). */
  forceClose: boolean;
}

const NONE: TripActions = {
  load: false,
  depart: false,
  departBlocked: false,
  place: false,
  close: false,
  forceClose: false,
};

/**
 * Thao tác được phép theo trạng thái + chủ chuyến + quyền. Chỉ người mở chuyến làm việc trên xe (BE 403
 * PUTAWAY_TRIP_NOT_YOURS); người có APPROVE đóng hộ chuyến của người khác. UI-only — Backend phải re-check (BR-15,
 * quyền warehouse-putaway-trips, phạm vi kho).
 */
export function tripActions(
  trip: Pick<PutawayTrip, "status" | "operatorId" | "cartons">,
  me: string | undefined,
  can: (code: PermissionCode) => boolean,
): TripActions {
  if (!isTripOpen(trip.status)) return NONE;
  const mine = !!me && trip.operatorId === me;
  if (!mine) return { ...NONE, forceClose: can(PUTAWAY_TRIP_PERMISSIONS.approve) };
  if (!can(PUTAWAY_TRIP_PERMISSIONS.update)) return NONE;
  const loading = trip.status === S.LOADING;
  return {
    load: loading,
    depart: loading,
    departBlocked: loading && trip.cartons.length === 0,
    place: trip.status === S.IN_PROGRESS,
    close: true,
    forceClose: false,
  };
}
