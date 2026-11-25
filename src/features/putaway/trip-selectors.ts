/**
 * Hàm thuần của màn chuyến cất hàng — tiến độ, điểm dừng kèm thùng, chỗ giữ đã hết hạn.
 */

import { PUTAWAY_TRIP_ITEM_STATUS as I } from "@/constants";

import type { PutawayTrip, PutawayTripCarton, PutawayTripStop } from "./types";

export function tripProgress(trip: Pick<PutawayTrip, "cartons">) {
  const live = trip.cartons.filter((c) => c.status !== I.RETURNED);
  return {
    placed: live.filter((c) => c.status === I.PLACED).length,
    total: live.length,
    onCart: trip.cartons.filter((c) => c.status === I.ON_CART).length,
  };
}

/**
 * Thùng trên xe đã có bin gán nhưng chỗ giữ đã nhả (30 phút không thao tác, BR-16) — bin có thể đã bị chiếm, nên
 * quét lại hoặc đổi bin.
 */
export const holdExpired = (carton: PutawayTripCarton) =>
  carton.status === I.ON_CART && !!carton.assignedLocationCode && !carton.holding;

export interface StopWithCartons extends PutawayTripStop {
  cartons: PutawayTripCarton[];
}

/** Điểm dừng theo thứ tự lộ trình, mỗi điểm kèm thùng của nó (theo LPN trong `stop.lpns`). */
export function stopsWithCartons(trip: Pick<PutawayTrip, "stops" | "cartons">): StopWithCartons[] {
  const byLpn = new Map(trip.cartons.map((c) => [c.lpn.toUpperCase(), c]));
  return [...trip.stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      ...stop,
      cartons: stop.lpns.flatMap((lpn) => {
        const carton = byLpn.get(lpn.toUpperCase());
        return carton ? [carton] : [];
      }),
    }));
}

/** Điểm dừng đã cất hết thùng · điểm nên tới tiếp · điểm còn lại. */
export type TripRouteStopState = "done" | "next" | "todo";

interface TripRoutePoint {
  locationCode: string | null;
  x: number;
  y: number;
}

export interface TripRoutePath {
  start: TripRoutePoint | null;
  /** Nơi BE sắp các điểm dừng còn lại — chặng 1 đi từ đây (có thể khác `start` sau khi đã cất thùng). */
  origin: TripRoutePoint | null;
  stops: {
    sequence: number;
    locationCode: string;
    x: number;
    y: number;
    state: TripRouteStopState;
    /** Đường đi BE tính tới điểm này (cả hai đầu); null → nối thẳng. */
    path: { x: number; y: number }[] | null;
  }[];
}

const hasPoint = <T extends { x?: number | null; y?: number | null }>(
  point: T,
): point is T & { x: number; y: number } => point.x != null && point.y != null;

/**
 * Đường nối các điểm dừng trên Kho Map 2D (docs 05 §4.5 bước 14): điểm gốc → điểm dừng theo `sequence`, toạ độ điểm
 * đứng và đường đi vòng kệ / tường do BE tính (BE #410) — FE chỉ vẽ, không sắp lại thứ tự (BR-17). Điểm không có toạ
 * độ bị bỏ khỏi đường (danh sách vẫn hiện), số thứ tự giữ nguyên để khớp danh sách. `next` = điểm đầu tiên còn thùng
 * trên xe — chỉ gợi ý, không bắt buộc đi đúng thứ tự.
 */
export function tripRoutePath(
  trip: Pick<
    PutawayTrip,
    | "stops"
    | "cartons"
    | "startLocationCode"
    | "startX"
    | "startY"
    | "originLocationCode"
    | "originX"
    | "originY"
  >,
): TripRoutePath {
  const stops = stopsWithCartons(trip);
  const done = (stop: StopWithCartons) => stop.cartons.every((c) => c.status !== I.ON_CART);
  const next = stops.find((stop) => !done(stop));
  const start = { locationCode: trip.startLocationCode ?? null, x: trip.startX, y: trip.startY };
  const origin = {
    locationCode: trip.originLocationCode ?? null,
    x: trip.originX,
    y: trip.originY,
  };
  return {
    start: hasPoint(start) ? start : null,
    origin: hasPoint(origin) ? origin : null,
    stops: stops.filter(hasPoint).map((stop) => ({
      sequence: stop.sequence,
      locationCode: stop.locationCode,
      x: stop.x,
      y: stop.y,
      state: stop === next ? "next" : done(stop) ? "done" : "todo",
      path: stop.path?.map(({ x, y }) => ({ x, y })) ?? null,
    })),
  };
}
