import type { PutawayTrip, PutawayTripCarton } from "../types";

/** Thùng trên xe dạng BE `PutawayTripResponse.Carton` — dữ liệu test. */
export function tripCarton(overrides: Partial<PutawayTripCarton> = {}): PutawayTripCarton {
  return {
    putawayTaskId: "t-1",
    lpn: "LPN-1",
    sku: "SKU-002-WHT",
    lotNumber: "LOT-A",
    status: "ON_CART",
    assignedLocationCode: null,
    stopSequence: null,
    holding: false,
    loadedAt: "2026-11-21T02:00:00Z",
    placedAt: null,
    ...overrides,
  };
}

export function trip(overrides: Partial<PutawayTrip> = {}): PutawayTrip {
  return {
    id: "trip-1",
    warehouseId: "wh-1",
    operatorId: "u-test",
    status: "LOADING",
    startLocationCode: null,
    startX: null,
    startY: null,
    startedAt: null,
    lastActivityAt: "2026-11-21T02:05:00Z",
    closedAt: null,
    closedBy: null,
    cartons: [],
    stops: [],
    ...overrides,
  };
}
