/**
 * Mock routes — chuyến cất hàng (docs 05 §4.5), khớp BE `PutawayTripController` + `PutawayTripService`: mở / xếp /
 * bỏ thùng / đi / đặt thùng / đổi bin / đóng / đóng hộ, lỗi đúng mã BE. Quyền theo mã (warehouse-putaway-trips).
 * Chỉ dùng khi USE_MOCK=true.
 */

import { PUTAWAY_LIMITS, PUTAWAY_TRIP_PERMISSIONS as P } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { mockWarehouseCodeOf } from "./mock-inventory-cartons";
import {
  cartonOf,
  closeReceiptIfDone,
  listPutawayTasks,
  suggestionsFor,
} from "./mock-putaway-store";
import {
  closeTripNow,
  findTrip,
  isOpen,
  openTripOf,
  saveTrip,
  startTrip,
  toTripResponse,
  tripCarrying,
} from "./mock-putaway-trips-store";
import { currentActor, forbidden } from "./mock-routes-fulfillment-store";
import { withIdempotency } from "./mock-routes-pick-lines-store";
import { checkTarget } from "./mock-routes-putaway";
import {
  beError,
  beOk,
  isRecord,
  parseJsonBody,
  readString,
} from "./mock-routes-purchase-orders-store";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { AxiosRequestConfig } from "axios";
import type { MockTrip } from "./mock-putaway-trips-store";

const upper = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

function param(config: AxiosRequestConfig, key: string): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return isRecord(params) ? decodeURIComponent(readString(params[key])) : "";
}

const invalidState = () =>
  beError(409, "PUTAWAY_TRIP_INVALID_STATE", "The trip cannot do that now");
const notYours = () => beError(403, "PUTAWAY_TRIP_NOT_YOURS", "Not your trip");
const notOnTrip = () =>
  beError(409, "PUTAWAY_CARTON_NOT_ON_TRIP", "The carton is not on this trip");

/** Chuyến của chính người gọi, cần UPDATE; trả lỗi BE nếu không. */
async function ownTrip(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor.can(P.update)) return { error: forbidden() };
  const trip = findTrip(param(config, "id"));
  if (!trip) return { error: beError(404, "PUTAWAY_TRIP_NOT_FOUND", "No putaway trip") };
  if (trip.operatorId !== actor.userId) return { error: notYours() };
  return { trip, actor };
}

const ok = (trip: MockTrip) => beOk(toTripResponse(saveTrip(trip)));

function registerRead(): void {
  registerMockRoute("GET", "/putaway-trips/current", async () => {
    const actor = await currentActor();
    if (!actor.can(P.read)) return forbidden();
    const trip = openTripOf(actor.userId);
    // ApiResponse NON_NULL: không có chuyến → envelope không có `data`
    return beOk(trip ? toTripResponse(trip) : undefined);
  });
  registerMockRoute("GET", "/putaway-trips/:id", async (config) => {
    if (!(await currentActor()).can(P.read)) return forbidden();
    const trip = findTrip(param(config, "id"));
    return trip
      ? beOk(toTripResponse(trip))
      : beError(404, "PUTAWAY_TRIP_NOT_FOUND", "No putaway trip");
  });
}

function registerOpen(): void {
  registerMockRoute("POST", "/putaway-trips", (config) =>
    withIdempotency(config, async () => {
      const actor = await currentActor();
      if (!actor.can(P.update)) return forbidden();
      const warehouseId = readString(parseJsonBody(config.data).warehouseId);
      const warehouse = getWarehouseStore().warehouses.get(warehouseId);
      if (!warehouse) return beError(400, "VALIDATION_FAILED", "Unknown warehouse");
      const open = openTripOf(actor.userId);
      if (open) return beError(409, "PUTAWAY_TRIP_ALREADY_OPEN", `Trip ${open.id} is still open`);
      const now = new Date().toISOString();
      return ok({
        id: crypto.randomUUID(),
        warehouseId,
        warehouseCode: warehouse.prefix,
        operatorId: actor.userId,
        status: "LOADING",
        startLocationCode: null,
        startX: null,
        startY: null,
        startedAt: null,
        lastActivityAt: now,
        closedAt: null,
        closedBy: null,
        cartons: [],
        stops: [],
      });
    }),
  );
}

function registerCart(): void {
  registerMockRoute("POST", "/putaway-trips/:id/cartons", (config) =>
    withIdempotency(config, async () => {
      const own = await ownTrip(config);
      if (own.error) return own.error;
      const { trip } = own;
      if (trip.status !== "LOADING") return invalidState();
      const lpn = readString(parseJsonBody(config.data).lpn).trim();
      if (!lpn || lpn.length > PUTAWAY_LIMITS.lpnMax) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "lpn", message: "must not be blank", code: "NotBlank" },
        ]);
      }
      if (trip.cartons.some((c) => upper(c.lpn) === upper(lpn) && c.status === "ON_CART"))
        return ok(trip);
      const task = (await listPutawayTasks()).find((t) => upper(t.lpn) === upper(lpn));
      const carton = task ? await cartonOf(task) : undefined;
      if (!carton && !task) return beError(404, "STOCK_PACKAGE_NOT_FOUND", "No such carton");
      if (!task || task.status !== "PENDING") {
        return beError(404, "PUTAWAY_TASK_NOT_FOUND", "No open putaway task for the carton");
      }
      const at = carton?.pkg.locationCode;
      if (!at) return beError(404, "LOCATION_NOT_FOUND", "The carton has no location");
      if (mockWarehouseCodeOf(at) !== upper(trip.warehouseCode)) {
        return beError(409, "MOVE_ACROSS_WAREHOUSES", "Stock moves only within one warehouse");
      }
      const other = tripCarrying(task.id);
      if (other && other.id !== trip.id) {
        return beError(409, "PUTAWAY_TASK_ON_ANOTHER_TRIP", "The carton is on another trip");
      }
      trip.cartons.push({
        putawayTaskId: task.id,
        lpn: task.lpn,
        sku: task.sku,
        lotNumber: task.lotNumber,
        quantity: task.quantity,
        status: "ON_CART",
        assignedLocationCode: null,
        stopSequence: null,
        holding: false,
        loadedAt: new Date().toISOString(),
        placedAt: null,
      });
      return ok(trip);
    }),
  );
  registerMockRoute("DELETE", "/putaway-trips/:id/cartons/:lpn", async (config) => {
    const own = await ownTrip(config);
    if (own.error) return own.error;
    const { trip } = own;
    const lpn = param(config, "lpn");
    if (!trip.cartons.some((c) => upper(c.lpn) === upper(lpn) && c.status === "ON_CART"))
      return notOnTrip();
    if (trip.status !== "LOADING") return invalidState();
    trip.cartons = trip.cartons.filter((c) => upper(c.lpn) !== upper(lpn));
    return ok(trip);
  });
}

function registerRun(): void {
  registerMockRoute("POST", "/putaway-trips/:id/departure", async (config) => {
    const own = await ownTrip(config);
    if (own.error) return own.error;
    const { trip } = own;
    if (trip.status !== "LOADING") return invalidState();
    if (trip.cartons.length === 0) return beError(422, "PUTAWAY_TRIP_EMPTY", "Load a carton first");
    await startTrip(trip);
    return ok(trip);
  });
  registerMockRoute("POST", "/putaway-trips/:id/placements", (config) =>
    withIdempotency(config, async () => {
      const own = await ownTrip(config);
      if (own.error) return own.error;
      const { trip } = own;
      if (trip.status !== "IN_PROGRESS") return invalidState();
      const body = parseJsonBody(config.data);
      const lpn = readString(body.lpn);
      const item = trip.cartons.find((c) => upper(c.lpn) === upper(lpn) && c.status === "ON_CART");
      if (!item) return notOnTrip();
      const task = (await listPutawayTasks()).find((t) => t.id === item.putawayTaskId);
      if (!task) return beError(404, "PUTAWAY_TASK_NOT_FOUND", "No putaway task");
      const carton = await cartonOf(task);
      // Chỗ giữ của chính thùng này không chặn nó (BR-16) — nhả trước khi kiểm bin
      item.holding = false;
      const target = await checkTarget(
        task,
        carton?.pkg.locationCode ?? "",
        readString(body.locationCode),
      );
      if (!("locationCode" in target)) return target;
      if (carton) carton.pkg.locationCode = target.locationCode;
      getWarehouseStore().stockedLocations.add(target.locationCode);
      task.status = "DONE";
      task.targetLocationCode = target.locationCode;
      item.status = "PLACED";
      item.placedAt = new Date().toISOString();
      await closeReceiptIfDone(task.goodsReceiptId);
      if (trip.cartons.every((c) => c.status !== "ON_CART")) trip.status = "COMPLETED";
      return ok(trip);
    }),
  );
  registerMockRoute("POST", "/putaway-trips/:id/cartons/:lpn/reassignment", async (config) => {
    const own = await ownTrip(config);
    if (own.error) return own.error;
    const { trip } = own;
    const lpn = param(config, "lpn");
    const item = trip.cartons.find((c) => upper(c.lpn) === upper(lpn) && c.status === "ON_CART");
    if (!item) return notOnTrip();
    if (trip.status !== "IN_PROGRESS") return invalidState();
    const previous = item.assignedLocationCode;
    item.holding = false;
    const task = (await listPutawayTasks()).find((t) => t.id === item.putawayTaskId);
    const from = task ? ((await cartonOf(task))?.pkg.locationCode ?? "") : "";
    const next = task
      ? (await suggestionsFor(task, from)).find((s) => s.locationCode !== previous)
      : undefined;
    item.assignedLocationCode = next?.locationCode ?? previous;
    item.holding = item.assignedLocationCode !== null;
    trip.stops = trip.stops
      .map((s) => ({ ...s, lpns: s.lpns.filter((l) => upper(l) !== upper(lpn)) }))
      .filter((s) => s.lpns.length > 0);
    const stop = trip.stops.find((s) => s.locationCode === item.assignedLocationCode);
    if (stop) stop.lpns.push(item.lpn);
    else if (item.assignedLocationCode) {
      trip.stops.push({
        sequence: trip.stops.length + 1,
        locationCode: item.assignedLocationCode,
        x: null,
        y: null,
        lpns: [item.lpn],
      });
    }
    trip.stops = trip.stops.map((s, index) => ({ ...s, sequence: index + 1 }));
    for (const c of trip.cartons) {
      c.stopSequence =
        trip.stops.find((s) => s.locationCode === c.assignedLocationCode)?.sequence ?? null;
    }
    return ok(trip);
  });
}

function registerClose(): void {
  registerMockRoute("POST", "/putaway-trips/:id/closure", async (config) => {
    const own = await ownTrip(config);
    if (own.error) return own.error;
    if (!isOpen(own.trip)) return invalidState();
    closeTripNow(own.trip, own.actor.userId);
    return ok(own.trip);
  });
  registerMockRoute("POST", "/putaway-trips/:id/forced-closure", async (config) => {
    const actor = await currentActor();
    if (!actor.can(P.approve)) return forbidden();
    const trip = findTrip(param(config, "id"));
    if (!trip) return beError(404, "PUTAWAY_TRIP_NOT_FOUND", "No putaway trip");
    if (!isOpen(trip)) return invalidState();
    closeTripNow(trip, actor.userId);
    return ok(trip);
  });
}

export function registerPutawayTripMockRoutes(): void {
  // `/current` phải đứng trước `/:id` (khớp theo thứ tự đăng ký)
  registerRead();
  registerOpen();
  registerCart();
  registerRun();
  registerClose();
}
