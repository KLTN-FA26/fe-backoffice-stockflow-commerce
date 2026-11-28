/**
 * Store mock chuyến cất hàng (docs 05 §4.5), chỉ dùng khi USE_MOCK=true. Khớp BE `PutawayTripService`: một chuyến mở
 * mỗi người và một chuyến mỗi nhiệm vụ (BR-15), gán bin lúc đi theo cùng bảng xếp hạng (cùng lô liền nhau), giữ chỗ
 * (BR-16), lộ trình láng giềng gần nhất theo khoảng cách Manhattan, OVERFLOW luôn cuối (BR-17: chỉ tham khảo).
 * ASSUMPTION (mock): chỗ giữ không tự nhả sau 30 phút — mock không chạy bộ quét hết hạn.
 */

import { mockStaffName, mockWarehouseNames } from "./mock-display-names";
import {
  areasOfWarehouse,
  cartonOf,
  cartonWeight,
  findPutawayTask,
  registerHoldSource,
  suggestionsFor,
} from "./mock-putaway-store";
import { getWarehouseStore } from "./mock-warehouse-store";

export type MockTripStatus = "LOADING" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";

export interface MockTripCarton {
  putawayTaskId: string;
  lpn: string;
  sku: string;
  lotNumber: string | null;
  quantity: number;
  status: "ON_CART" | "PLACED" | "RETURNED";
  assignedLocationCode: string | null;
  stopSequence: number | null;
  holding: boolean;
  loadedAt: string;
  placedAt: string | null;
}

export interface MockTrip {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  operatorId: string;
  status: MockTripStatus;
  startLocationCode: string | null;
  startX: number | null;
  startY: number | null;
  startedAt: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  closedBy: string | null;
  cartons: MockTripCarton[];
  stops: {
    sequence: number;
    locationCode: string;
    x: number | null;
    y: number | null;
    lpns: string[];
  }[];
}

const trips = new Map<string, MockTrip>();
const upper = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

export function resetPutawayTripsMockStore(): void {
  trips.clear();
}

export const isOpen = (trip: MockTrip) =>
  trip.status === "LOADING" || trip.status === "IN_PROGRESS";
export const findTrip = (id: string) => trips.get(id);
export const openTripOf = (operatorId: string) =>
  [...trips.values()].find((t) => t.operatorId === operatorId && isOpen(t));
/** Chuyến mở đang chở thùng của nhiệm vụ này (BR-15: một nhiệm vụ trên tối đa một xe). */
export const tripCarrying = (taskId: string) =>
  [...trips.values()].find(
    (t) => isOpen(t) && t.cartons.some((c) => c.putawayTaskId === taskId && c.status === "ON_CART"),
  );

export function saveTrip(trip: MockTrip): MockTrip {
  trip.lastActivityAt = new Date().toISOString();
  trips.set(trip.id, trip);
  return trip;
}

// Chỗ đang giữ của mọi chuyến mở — store cất hàng trừ đi khi tính chỗ trống (BR-16)
registerHoldSource((locationCode) => {
  const held = [...trips.values()]
    .filter(isOpen)
    .flatMap((t) => t.cartons)
    .filter(
      (c) =>
        c.status === "ON_CART" &&
        c.holding &&
        upper(c.assignedLocationCode) === upper(locationCode),
    );
  return {
    cartons: held.length,
    weightKg: held.reduce((sum, c) => sum + cartonWeight(c.quantity), 0),
  };
});

/** Điểm đứng trước bin (mặt lấy hàng phía nam của kệ, docs 06 §4.4 bước 6) hoặc tâm khu. */
export function pointOf(code: string): { x: number; y: number } | null {
  const store = getWarehouseStore();
  for (const shelf of store.shelves) {
    for (const level of shelf.levels) {
      const bin = level.bins.find((b) => upper(b.locationCode) === upper(code));
      if (bin) {
        return {
          x: shelf.footprint.x + bin.footprint.x + bin.footprint.width / 2,
          y: shelf.footprint.y + shelf.footprint.length + 0.5,
        };
      }
    }
  }
  const area = store.areas.find((a) => upper(a.location?.locationCode) === upper(code));
  return area
    ? {
        x: area.footprint.x + area.footprint.width / 2,
        y: area.footprint.y + area.footprint.length / 2,
      }
    : null;
}

const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Gán bin cho từng thùng (cùng lô liền nhau) rồi xếp điểm dừng — BE `PutawayTripService#start`. */
export async function startTrip(trip: MockTrip): Promise<void> {
  const overflow = areasOfWarehouse(trip.warehouseCode)
    .filter((a) => a.type === "OVERFLOW" && a.usable)
    .map((a) => a.locationCode)
    .sort();
  const ordered = [...trip.cartons].sort((a, b) =>
    `${a.sku}|${a.lotNumber ?? ""}|${a.lpn}`.localeCompare(
      `${b.sku}|${b.lotNumber ?? ""}|${b.lpn}`,
    ),
  );
  let from: string | null = null;
  for (const carton of ordered) {
    const task = await findPutawayTask(carton.putawayTaskId);
    const source = task ? ((await cartonOf(task))?.pkg.locationCode ?? null) : null;
    // Xuất phát từ khu của thùng đầu tiên (khu nhận / khu cách ly), docs 05 §4.5 bước 12
    from ??= source;
    const best = task && source ? (await suggestionsFor(task, source))[0]?.locationCode : undefined;
    carton.assignedLocationCode = best ?? overflow[0] ?? null;
    carton.holding = carton.assignedLocationCode !== null;
  }
  const start = from ? pointOf(from) : null;
  trip.startLocationCode = from;
  trip.startX = start?.x ?? null;
  trip.startY = start?.y ?? null;
  const bins = [
    ...new Set(ordered.flatMap((c) => (c.assignedLocationCode ? [c.assignedLocationCode] : []))),
  ];
  const regular = bins.filter((b) => !overflow.includes(b));
  const route: string[] = [];
  let at = start;
  while (regular.length > 0) {
    regular.sort((a, b) => {
      const pa = pointOf(a);
      const pb = pointOf(b);
      if (!at || !pa || !pb) return a.localeCompare(b);
      return manhattan(at, pa) - manhattan(at, pb) || a.localeCompare(b);
    });
    const next = regular.shift() ?? "";
    route.push(next);
    at = pointOf(next) ?? at;
  }
  route.push(...bins.filter((b) => overflow.includes(b)));
  trip.stops = route.map((code, index) => {
    const point = pointOf(code);
    return {
      sequence: index + 1,
      locationCode: code,
      x: point?.x ?? null,
      y: point?.y ?? null,
      lpns: ordered.filter((c) => c.assignedLocationCode === code).map((c) => c.lpn),
    };
  });
  for (const carton of trip.cartons) {
    carton.stopSequence =
      trip.stops.find((s) => s.locationCode === carton.assignedLocationCode)?.sequence ?? null;
  }
  trip.status = "IN_PROGRESS";
  trip.startedAt = new Date().toISOString();
}

/** Đóng chuyến: thùng còn trên xe trả về hàng chờ, nhả chỗ giữ (docs 05 §5, BR-16). */
export function closeTripNow(trip: MockTrip, by: string): void {
  for (const carton of trip.cartons) {
    if (carton.status === "ON_CART") {
      carton.status = "RETURNED";
      carton.holding = false;
    }
  }
  trip.status = "CLOSED";
  trip.closedAt = new Date().toISOString();
  trip.closedBy = by;
}

/**
 * Điểm gốc — BE `PutawayTripsImpl#origins`: bin của thùng cất gần nhất nếu đặt được lên bản đồ, không thì khu nguồn.
 */
function originOf(trip: MockTrip) {
  // Cùng mốc thời gian → thùng cất sau (đứng sau trong danh sách) thắng
  const placed = trip.cartons
    .filter((c) => c.status === "PLACED" && c.placedAt && c.assignedLocationCode)
    .reduce<MockTripCarton | null>(
      (last, c) => (!last || (c.placedAt ?? "") >= (last.placedAt ?? "") ? c : last),
      null,
    )?.assignedLocationCode;
  const point = placed ? pointOf(placed) : null;
  return placed && point
    ? { originLocationCode: placed, originX: point.x, originY: point.y }
    : { originLocationCode: trip.startLocationCode, originX: trip.startX, originY: trip.startY };
}

/** BE `PutawayTripResponse` — bỏ field nội bộ của mock (mã kho, SL thùng). */
export function toTripResponse(trip: MockTrip) {
  return {
    id: trip.id,
    warehouseId: trip.warehouseId,
    operatorId: trip.operatorId,
    status: trip.status,
    startLocationCode: trip.startLocationCode,
    startX: trip.startX,
    startY: trip.startY,
    // BE #410: điểm gốc của lộ trình + đường đi từng chặng. Mock không tìm đường (mock không chứa nghiệp vụ) và không
    // sắp lại sau khi cất → `path` null để FE nối thẳng (nhánh dự phòng của BE)
    ...(trip.status === "IN_PROGRESS"
      ? originOf(trip)
      : { originLocationCode: null, originX: null, originY: null }),
    startedAt: trip.startedAt,
    lastActivityAt: trip.lastActivityAt,
    closedAt: trip.closedAt,
    closedBy: trip.status === "CLOSED" ? trip.closedBy : null,
    // Issue #286: tên người cất / người đóng, mã + tên kho cạnh id
    operatorName: mockStaffName(trip.operatorId),
    closedByName: trip.status === "CLOSED" ? mockStaffName(trip.closedBy) : null,
    warehouseCode: trip.warehouseCode,
    warehouseName: mockWarehouseNames(trip.warehouseId).warehouseName,
    cartons: trip.cartons.map((c) => ({
      putawayTaskId: c.putawayTaskId,
      lpn: c.lpn,
      sku: c.sku,
      lotNumber: c.lotNumber,
      status: c.status,
      assignedLocationCode: c.assignedLocationCode,
      stopSequence: c.stopSequence,
      holding: c.holding,
      loadedAt: c.loadedAt,
      placedAt: c.placedAt,
    })),
    stops: trip.status === "IN_PROGRESS" ? trip.stops.map((s) => ({ ...s, path: null })) : [],
  };
}
