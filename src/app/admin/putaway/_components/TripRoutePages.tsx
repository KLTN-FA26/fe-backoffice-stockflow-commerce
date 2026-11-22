"use client";

import { MyTripPage, TripPage, tripRoutePath } from "@/features/putaway";
import { WarehouseRouteMap } from "@/features/warehouse-map/components/map/WarehouseRouteMap";

import type { PutawayTrip } from "@/features/putaway";

/**
 * Ghép hai feature cho màn chuyến cất (docs 05 §4.5 bước 14): cất hàng tính điểm dừng, bản đồ kho vẽ đường nối trên
 * Kho Map 2D. Đặt ở tầng route vì feature không import feature khác; tách file client vì trang server không truyền được
 * hàm render sang component client.
 */
const routeMap = (trip: PutawayTrip) => (
  <WarehouseRouteMap warehouseId={trip.warehouseId} path={tripRoutePath(trip)} />
);

export function MyTripRoutePage() {
  return <MyTripPage routeMap={routeMap} />;
}

export function TripRoutePage({ tripId }: { tripId: string }) {
  return <TripPage tripId={tripId} routeMap={routeMap} />;
}
