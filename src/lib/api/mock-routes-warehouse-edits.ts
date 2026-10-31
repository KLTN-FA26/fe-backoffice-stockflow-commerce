/**
 * Mock sửa bản đồ kho — `PUT /zones|shelves|areas|boundaries/{id}`, `GET /shelves/{id}` của BE, cùng mã
 * lỗi (OPTIMISTIC_LOCK, LAYOUT_*, PICK_FACE_REQUIRED, AREA_TYPE_CHANGE_NOT_ALLOWED). Thêm
 * `GET /inventory/warehouses/{id}/stock-items` cho kho của store bản đồ (chỉ trả mã vị trí còn tồn);
 * kho khác chuyển cho mock tồn kho sẵn có. Chỉ dùng khi USE_MOCK=true.
 */

import { WAREHOUSE_LOCATION_PERMISSIONS as P } from "@/constants";

import { registerMockRoute, resolveMockRoute } from "./mock-adapter";
import {
  bodyOf,
  fail,
  ok,
  optimisticLock,
  pageOf,
  pathParams,
  queryOf,
  text,
} from "./mock-route-utils";
import {
  boxOf,
  footprintOf,
  forbidden,
  invalid,
  mockCan,
  placementError,
  warehouseOf,
} from "./mock-warehouse-rules";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { AxiosRequestConfig } from "axios";
import type { MockResponseShape } from "./mock-route-utils";
import type { MockShelf } from "./mock-warehouse-store";

const STOCK_ITEMS = "/inventory/warehouses/:id/stock-items";
const versionOf = (config: AxiosRequestConfig) => Number(bodyOf(config).version);
const shelfNotFound = () => fail(404, "SHELF_NOT_FOUND", "Shelf not found");
const optionalNumber = (value: unknown) => (value == null ? null : Number(value));

/** Bin vượt cạnh mới của kệ → BE từ chối thu nhỏ (409 LAYOUT_OUT_OF_BOUNDS). */
const binsFit = (shelf: MockShelf, width: number, length: number) =>
  shelf.levels.every((level) =>
    level.bins.every((bin) => {
      const b = boxOf(bin.footprint);
      return b.x + b.w <= width + 1e-9 && b.y + b.h <= length + 1e-9;
    }),
  );

function registerShelfEdits(): void {
  registerMockRoute("GET", "/shelves/:id", async (config) => {
    if (!(await mockCan(P.read))) return forbidden();
    const shelf = getWarehouseStore().shelves.find((s) => s.id === pathParams(config).id);
    return shelf ? ok(shelf) : shelfNotFound();
  });

  registerMockRoute("PUT", "/shelves/:id", async (config) => {
    if (!(await mockCan(P.update))) return forbidden();
    const shelf = getWarehouseStore().shelves.find((s) => s.id === pathParams(config).id);
    if (!shelf) return shelfNotFound();
    if (versionOf(config) !== shelf.version) return optimisticLock();
    const body = bodyOf(config);
    const name = text(body.name);
    if (!name) return invalid("name", "must not be blank");
    const footprint = footprintOf(body.footprint);
    if (!footprint) return invalid("footprint", "is not a valid footprint");
    const warehouse = warehouseOf(shelf.warehouseId);
    const placed =
      warehouse && shelf.status !== "INACTIVE"
        ? placementError(warehouse, footprint, shelf.id)
        : null;
    if (placed) return placed;
    if (!binsFit(shelf, footprint.width, footprint.length))
      return fail(409, "LAYOUT_OUT_OF_BOUNDS", "The shelf would no longer hold its bins");
    const faces = (body.pickFaces ?? {}) as Record<string, unknown>;
    const pickFaces = {
      north: faces.north === true,
      east: faces.east === true,
      south: faces.south === true,
      west: faces.west === true,
    };
    const pickable = shelf.levels.some((level) => level.bins.some((bin) => bin.pickable));
    if (pickable && !Object.values(pickFaces).some(Boolean))
      return fail(409, "PICK_FACE_REQUIRED", "A shelf with pickable bins needs a pick face");
    Object.assign(shelf, {
      name,
      description: text(body.description) || null,
      zoneId: text(body.zoneId) || null,
      footprint,
      obstacle: body.obstacle === true,
      pickFaces,
      defaultStorageClass: text(body.defaultStorageClass) || "NORMAL",
      version: shelf.version + 1,
    });
    return ok(shelf);
  });
}

function registerAreaEdits(): void {
  registerMockRoute("PUT", "/areas/:id", async (config) => {
    if (!(await mockCan(P.update))) return forbidden();
    const area = getWarehouseStore().areas.find((a) => a.id === pathParams(config).id);
    if (!area) return fail(404, "LOCATION_NOT_FOUND", "Not found");
    if (versionOf(config) !== area.version) return optimisticLock();
    const body = bodyOf(config);
    const type = text(body.type);
    // BR-11: khu chứa hàng không đổi thành NON_STORAGE (issue #18 D10)
    if (area.location && type === "NON_STORAGE")
      return fail(409, "AREA_TYPE_CHANGE_NOT_ALLOWED", "A storage area cannot become NON_STORAGE");
    const footprint = footprintOf(body.footprint);
    if (!footprint) return invalid("footprint", "is not a valid footprint");
    const warehouse = warehouseOf(area.warehouseId);
    const placed =
      warehouse && area.status !== "INACTIVE"
        ? placementError(warehouse, footprint, area.id)
        : null;
    if (placed) return placed;
    const loc = body.location as Record<string, unknown> | undefined;
    if (type !== "NON_STORAGE" && !loc) return invalid("location", "is required for this type");
    Object.assign(area, {
      type,
      name: text(body.name),
      footprint,
      obstacle: body.obstacle === true,
      version: area.version + 1,
      location:
        type === "NON_STORAGE" || !loc
          ? null
          : {
              locationId: area.location?.locationId ?? crypto.randomUUID(),
              locationCode:
                area.location?.locationCode ?? `${warehouse?.prefix ?? ""}-${area.code}`,
              storageClass: text(loc.storageClass) || "NORMAL",
              capacityUnits: optionalNumber(loc.capacityUnits),
              maxWeight: optionalNumber(loc.maxWeight),
              pickable: loc.pickable === true,
              putawayTarget: loc.putawayTarget === true,
            },
    });
    return ok({ ...area, ...area.location });
  });
}

function registerBoundaryAndZoneEdits(): void {
  registerMockRoute("PUT", "/boundaries/:id", async (config) => {
    if (!(await mockCan(P.update))) return forbidden();
    const boundary = getWarehouseStore().boundaries.find((b) => b.id === pathParams(config).id);
    if (!boundary) return fail(404, "BOUNDARY_NOT_FOUND", "Boundary not found");
    if (versionOf(config) !== boundary.version) return optimisticLock();
    const body = bodyOf(config);
    const [startX, startY, endX, endY] = [body.startX, body.startY, body.endX, body.endY].map(
      Number,
    );
    const warehouse = warehouseOf(boundary.warehouseId);
    const inside = (x: number, y: number) =>
      warehouse !== null && x >= 0 && y >= 0 && x <= warehouse.mapWidth && y <= warehouse.mapHeight;
    if (!inside(startX, startY) || !inside(endX, endY))
      return fail(409, "LAYOUT_OUT_OF_BOUNDS", "An end of the boundary leaves the map");
    const door = body.type === "DOOR";
    Object.assign(boundary, {
      type: door ? "DOOR" : "WALL",
      startX,
      startY,
      endX,
      endY,
      passable: door && body.passable === true,
      operationalStatus: door ? (body.operationalStatus === "CLOSED" ? "CLOSED" : "OPEN") : null,
      version: boundary.version + 1,
    });
    return ok(boundary);
  });

  registerMockRoute("PUT", "/zones/:id", async (config) => {
    if (!(await mockCan(P.update))) return forbidden();
    const { zones } = getWarehouseStore();
    const zone = zones.find((z) => z.id === pathParams(config).id);
    if (!zone) return fail(404, "ZONE_NOT_FOUND", "Zone not found");
    if (versionOf(config) !== zone.version) return optimisticLock();
    const body = bodyOf(config);
    const name = text(body.name);
    if (!name) return invalid("name", "must not be blank");
    const taken = zones.some(
      (z) =>
        z !== zone &&
        z.warehouseId === zone.warehouseId &&
        z.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) return fail(409, "ZONE_NAME_ALREADY_EXISTS", "This zone name is already in use");
    Object.assign(zone, { name, color: text(body.color) || null, version: zone.version + 1 });
    return ok(zone);
  });
}

/** Kho của store bản đồ: dòng tồn theo `stockedLocations`; kho khác → mock tồn kho đã đăng ký trước. */
function registerStockProbe(): void {
  const previous = resolveMockRoute("GET", STOCK_ITEMS.replace(":id", "probe"))?.handler;
  registerMockRoute("GET", STOCK_ITEMS, async (config): Promise<MockResponseShape> => {
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse)
      return previous ? previous(config) : fail(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
    const params = queryOf(config);
    const location = (params.get("location") ?? "").trim().toUpperCase();
    const rows = [...getWarehouseStore().stockedLocations]
      .filter((code) => code.startsWith(`${warehouse.prefix}-`) && code.startsWith(location))
      .sort()
      .map((locationCode) => ({ locationCode }));
    return ok(pageOf(rows, Number(params.get("page")) || 0, Number(params.get("size")) || 20));
  });
}

export function registerWarehouseEditMockRoutes(): void {
  registerShelfEdits();
  registerAreaEdits();
  registerBoundaryAndZoneEdits();
  registerStockProbe();
}
