/**
 * Mock vẽ bản đồ kho — `ShelfController` / `AreaController` / `BoundaryController` của BE: đặt kệ, thêm
 * tầng, tự sinh bin (BR-14, như `BinGrid`), đặt khu vực, vẽ / xoá tường-cửa, đổi trạng thái kệ / khu vực.
 * Cùng mã lỗi BE (LAYOUT_OUT_OF_BOUNDS, LAYOUT_OVERLAP, PICK_FACE_REQUIRED, SHELF_*). USE_MOCK=true.
 */

import { WAREHOUSE_LOCATION_PERMISSIONS as P } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  bodyOf,
  fail,
  noContent,
  ok,
  optimisticLock,
  pathParams,
  queryOf,
  text,
} from "./mock-route-utils";
import {
  footprintOf,
  forbidden,
  invalid,
  locationPart,
  mockCan,
  notFound,
  placementError,
  warehouseOf,
} from "./mock-warehouse-rules";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { AxiosRequestConfig } from "axios";
import type { MockBin, MockFootprint, MockLocationStatus, MockShelf } from "./mock-warehouse-store";

type Placed = {
  id: string;
  warehouseId: string;
  footprint: MockFootprint;
  status: MockLocationStatus;
  version: number;
};

const STATUSES: readonly string[] = ["ACTIVE", "BLOCKED", "MAINTENANCE", "INACTIVE"];
const optionalNumber = (value: unknown) => (value == null ? null : Number(value));
const shelfOf = (config: AxiosRequestConfig) =>
  getWarehouseStore().shelves.find((s) => s.id === pathParams(config).id) ?? null;
const shelfNotFound = () => fail(404, "SHELF_NOT_FOUND", "Shelf not found");
const hasPickFace = (shelf: MockShelf) => Object.values(shelf.pickFaces).some(Boolean);

/** BR-14 như BE `BinGrid.generate`: cạnh ÷ số cột / hàng làm tròn xuống mm, mã theo hàng rồi cột. */
function binGrid(shelf: MockShelf, rows: number, columns: number, scheme: string) {
  const width = Math.floor((shelf.footprint.width / columns) * 1000) / 1000;
  const length = Math.floor((shelf.footprint.length / rows) * 1000) / 1000;
  const digits = Math.max(2, String(scheme === "SEQUENTIAL" ? rows * columns : columns).length);
  const pad = (n: number) => String(n).padStart(digits, "0");
  return Array.from({ length: rows * columns }, (_, i) => {
    const row = Math.floor(i / columns);
    const column = i % columns;
    const code =
      scheme === "SEQUENTIAL" ? pad(i + 1) : `${String.fromCharCode(65 + row)}${pad(column + 1)}`;
    return { code, footprint: { x: column * width, y: row * length, width, length, rotation: 0 } };
  });
}

function registerShelfRoutes(): void {
  registerMockRoute("POST", "/warehouses/:id/shelves", async (config) => {
    if (!(await mockCan(P.create))) return forbidden();
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse) return notFound();
    const body = bodyOf(config);
    const code = locationPart(body.code, 20);
    if (!code) return invalid("code", "must match [A-Za-z0-9]{1,20}");
    const name = text(body.name);
    if (!name) return invalid("name", "must not be blank");
    const footprint = footprintOf(body.footprint);
    if (!footprint) return invalid("footprint", "is not a valid footprint");
    const placed = placementError(warehouse, footprint);
    if (placed) return placed;
    const { shelves } = getWarehouseStore();
    if (shelves.some((s) => s.warehouseId === warehouse.id && s.code === code))
      return fail(409, "SHELF_CODE_ALREADY_EXISTS", "This shelf code is already in use");
    const faces = (body.pickFaces ?? {}) as Record<string, unknown>;
    const shelf: MockShelf = {
      id: crypto.randomUUID(),
      warehouseId: warehouse.id,
      zoneId: text(body.zoneId) || null,
      code,
      name,
      description: text(body.description) || null,
      footprint,
      obstacle: body.obstacle === true,
      pickFaces: {
        north: faces.north === true,
        east: faces.east === true,
        south: faces.south === true,
        west: faces.west === true,
      },
      defaultStorageClass: text(body.defaultStorageClass) || "NORMAL",
      status: "ACTIVE",
      version: 0,
      levels: [],
    };
    shelves.push(shelf);
    return ok({ ...shelf, levels: [] }, 201);
  });

  registerMockRoute("POST", "/shelves/:id/levels", async (config) => {
    if (!(await mockCan(P.create))) return forbidden();
    const shelf = shelfOf(config);
    if (!shelf) return shelfNotFound();
    const body = bodyOf(config);
    const levelIndex = Number(body.levelIndex);
    if (!Number.isInteger(levelIndex) || levelIndex < 1 || levelIndex > 99)
      return invalid("levelIndex", "must be between 1 and 99");
    // BR-15: tối đa 20 tầng mỗi kệ; thứ tự tầng duy nhất trong kệ
    if (shelf.levels.length >= 20)
      return fail(409, "SHELF_CAPACITY_EXCEEDED", "A shelf holds at most 20 levels");
    if (shelf.levels.some((l) => l.levelIndex === levelIndex))
      return fail(409, "SHELF_LEVEL_ALREADY_EXISTS", "This level index is already in use");
    const level = {
      id: crypto.randomUUID(),
      levelIndex,
      elevation: optionalNumber(body.elevation),
      usableHeight: optionalNumber(body.usableHeight),
      maxWeight: optionalNumber(body.maxWeight),
      bins: [],
    };
    shelf.levels.push(level);
    return ok(level, 201);
  });

  registerMockRoute("POST", "/shelves/:id/bin-generation", async (config) => {
    if (!(await mockCan(P.create))) return forbidden();
    const shelf = shelfOf(config);
    if (!shelf) return shelfNotFound();
    const body = bodyOf(config);
    const levelIds = Array.isArray(body.levelIds) ? body.levelIds.map(String) : [];
    const [rows, columns] = [Number(body.rowCount), Number(body.columnCount)];
    const scheme = text(body.namingScheme) || "SEQUENTIAL";
    const defaults = (body.defaults ?? {}) as Record<string, unknown>;
    const levels = levelIds.map((id) => shelf.levels.find((l) => l.id === id));
    if (levels.some((l) => !l))
      return fail(404, "SHELF_LEVEL_NOT_FOUND", "A chosen level is not on this shelf");
    if (levels.some((l) => (l?.bins.length ?? 0) > 0))
      return fail(409, "SHELF_LEVEL_HAS_BINS", "A chosen level already has bins");
    if (rows * columns > 200 || (scheme === "ROW_LETTER_COLUMN" && rows > 26))
      return fail(409, "SHELF_CAPACITY_EXCEEDED", "Too many bins for one level");
    if (defaults.pickable === true && !hasPickFace(shelf))
      return fail(409, "PICK_FACE_REQUIRED", "A pickable bin needs a pick face on its shelf");
    const { prefix } = warehouseOf(shelf.warehouseId) ?? { prefix: "" };
    const generated = levels.flatMap((level) =>
      level
        ? binGrid(shelf, rows, columns, scheme).map((cell) => {
            const bin: MockBin = {
              id: crypto.randomUUID(),
              code: cell.code,
              description: null,
              footprint: cell.footprint,
              type: text(defaults.type) || "STANDARD",
              storageClassOverride: text(defaults.storageClassOverride) || null,
              locationId: crypto.randomUUID(),
              locationCode: `${prefix}-${shelf.code}-${level.levelIndex}-${cell.code}`,
              storageClass: text(defaults.storageClassOverride) || shelf.defaultStorageClass,
              capacityUnits: optionalNumber(defaults.capacityUnits),
              maxWeight: optionalNumber(defaults.maxWeight),
              pickable: defaults.pickable === true,
              putawayTarget: defaults.putawayTarget === true,
              status: "ACTIVE",
            };
            level.bins.push(bin);
            return { ...bin, levelId: level.id };
          })
        : [],
    );
    return ok(generated, 201);
  });
}

function registerAreaAndBoundaryRoutes(): void {
  registerMockRoute("POST", "/warehouses/:id/areas", async (config) => {
    if (!(await mockCan(P.create))) return forbidden();
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse) return notFound();
    const body = bodyOf(config);
    const code = locationPart(body.code, 20);
    if (!code) return invalid("code", "must match [A-Za-z0-9]{1,20}");
    const footprint = footprintOf(body.footprint);
    if (!footprint) return invalid("footprint", "is not a valid footprint");
    const placed = placementError(warehouse, footprint);
    if (placed) return placed;
    const { areas } = getWarehouseStore();
    if (areas.some((a) => a.warehouseId === warehouse.id && a.code === code))
      return fail(409, "AREA_CODE_ALREADY_EXISTS", "This area code is already in use");
    const type = text(body.type);
    const loc = body.location as Record<string, unknown> | undefined;
    if (type !== "NON_STORAGE" && !loc) return invalid("location", "is required for this type");
    const area = {
      id: crypto.randomUUID(),
      warehouseId: warehouse.id,
      code,
      type,
      name: text(body.name),
      footprint,
      obstacle: body.obstacle === true,
      status: "ACTIVE" as const,
      version: 0,
      location:
        type === "NON_STORAGE" || !loc
          ? null
          : {
              locationId: crypto.randomUUID(),
              locationCode: `${warehouse.prefix}-${code}`,
              storageClass: text(loc.storageClass) || "NORMAL",
              capacityUnits: optionalNumber(loc.capacityUnits),
              maxWeight: optionalNumber(loc.maxWeight),
              pickable: loc.pickable === true,
              putawayTarget: loc.putawayTarget === true,
            },
    };
    areas.push(area);
    return ok({ ...area, ...area.location }, 201);
  });

  registerMockRoute("POST", "/warehouses/:id/boundaries", async (config) => {
    if (!(await mockCan(P.create))) return forbidden();
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse) return notFound();
    const body = bodyOf(config);
    const [startX, startY, endX, endY] = [body.startX, body.startY, body.endX, body.endY].map(
      Number,
    );
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x <= warehouse.mapWidth && y <= warehouse.mapHeight;
    if (!inside(startX, startY) || !inside(endX, endY))
      return fail(409, "LAYOUT_OUT_OF_BOUNDS", "An end of the boundary leaves the map");
    const door = body.type === "DOOR";
    const boundary = {
      id: crypto.randomUUID(),
      warehouseId: warehouse.id,
      type: door ? ("DOOR" as const) : ("WALL" as const),
      startX,
      startY,
      endX,
      endY,
      passable: door && body.passable === true,
      operationalStatus: door ? (body.operationalStatus === "CLOSED" ? "CLOSED" : "OPEN") : null,
      version: 0,
    } as const;
    getWarehouseStore().boundaries.push({ ...boundary });
    return ok(boundary, 201);
  });

  registerMockRoute("DELETE", "/boundaries/:id", async (config) => {
    if (!(await mockCan(P.delete))) return forbidden();
    const store = getWarehouseStore();
    const index = store.boundaries.findIndex((b) => b.id === pathParams(config).id);
    if (index < 0) return fail(404, "BOUNDARY_NOT_FOUND", "Boundary not found");
    // BE: xoá hẳn nên bắt buộc `?version=` (thiếu → 400), bản cũ → 409 OPTIMISTIC_LOCK
    const version = queryOf(config).get("version");
    if (version === null || !/^\d+$/.test(version)) return invalid("version", "is required");
    if (Number(version) !== store.boundaries[index]?.version) return optimisticLock();
    store.boundaries.splice(index, 1);
    return noContent();
  });

  for (const kind of ["shelves", "areas"] as const) {
    registerMockRoute("PUT", `/${kind}/:id/status`, async (config) => {
      if (!(await mockCan(P.update))) return forbidden();
      const store = getWarehouseStore();
      const list: Placed[] = store[kind];
      const place = list.find((item) => item.id === pathParams(config).id);
      if (!place) return fail(404, "LOCATION_NOT_FOUND", "Not found");
      const status = text(bodyOf(config).status);
      if (!STATUSES.includes(status)) return invalid("status", "must not be null");
      // docs 06 §4.2: ra khỏi INACTIVE đòi chỗ cũ còn trống (409 LAYOUT_OVERLAP)
      const warehouse = warehouseOf(place.warehouseId);
      if (warehouse && place.status === "INACTIVE" && status !== "INACTIVE") {
        const clash = placementError(warehouse, place.footprint);
        if (clash) return clash;
      }
      place.status = status as MockLocationStatus;
      place.version += 1;
      return ok(place);
    });
  }
}

export function registerWarehouseShelfMockRoutes(): void {
  registerShelfRoutes();
  registerAreaAndBoundaryRoutes();
}
