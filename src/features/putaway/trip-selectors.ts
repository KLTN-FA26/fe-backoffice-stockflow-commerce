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
