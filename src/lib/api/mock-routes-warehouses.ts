/**
 * Mock module 06 theo hợp đồng BE (`WarehouseController`, `ZoneController`): danh mục kho, khai báo kho,
 * zone. Kệ / khu vực / tường-cửa ở `mock-routes-warehouse-shelves.ts`; `GET /warehouses/{id}/layout` ở
 * `mock-routes-warehouse-layout.ts` (đọc store này trước). Chỉ dùng khi USE_MOCK=true.
 */

import { WAREHOUSE_LOCATION_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import { registerWarehouseShelfMockRoutes } from "./mock-routes-warehouse-shelves";
import {
  forbidden,
  invalid,
  locationPart,
  mockCan,
  notFound,
  warehouseOf,
} from "./mock-warehouse-rules";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { MockWarehouse } from "./mock-warehouse-store";

const positiveMeasure = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && Math.round(n * 1000) === n * 1000 ? n : null;
};

function registerWarehouseRoutes(): void {
  registerMockRoute("GET", "/warehouses", async (config) => {
    const params = queryOf(config);
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const status = params.get("status");
    const rows = [...getWarehouseStore().warehouses.values()]
      .filter((w) => !status || w.status === status.toUpperCase())
      .filter((w) => !q || `${w.prefix} ${w.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 20);
    return ok(pageOf(rows, page, size));
  });

  registerMockRoute("GET", "/warehouses/:id", async (config) => {
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    return warehouse ? ok(warehouse) : notFound();
  });

  registerMockRoute("POST", "/warehouses", async (config) => {
    if (!(await mockCan(WAREHOUSE_PERMISSIONS.create))) return forbidden();
    const body = bodyOf(config);
    const prefix = locationPart(body.prefix, 10);
    if (!prefix) return invalid("prefix", "must match [A-Za-z0-9]{1,10}");
    const name = text(body.name);
    const address = text(body.address);
    if (!name || name.length > 200) return invalid("name", "must not be blank");
    if (!address || address.length > 500) return invalid("address", "must not be blank");
    if (body.mapUnit !== "M") return invalid("mapUnit", "must not be null");
    const mapWidth = positiveMeasure(body.mapWidth);
    const mapHeight = positiveMeasure(body.mapHeight);
    if (mapWidth === null) return invalid("mapWidth", "must be greater than 0");
    if (mapHeight === null) return invalid("mapHeight", "must be greater than 0");
    const { warehouses } = getWarehouseStore();
    if ([...warehouses.values()].some((w) => w.prefix === prefix))
      return fail(409, "WAREHOUSE_PREFIX_ALREADY_EXISTS", "This prefix is already in use");
    const warehouse: MockWarehouse = {
      id: crypto.randomUUID(),
      prefix,
      name,
      address,
      returnAddress: text(body.returnAddress) || null,
      mapUnit: "M",
      mapWidth,
      mapHeight,
      status: "ACTIVE",
      version: 0,
      createdAt: new Date().toISOString(),
    };
    warehouses.set(warehouse.id, warehouse);
    return ok(warehouse, 201);
  });

  registerMockRoute("POST", "/warehouses/:id/zones", async (config) => {
    if (!(await mockCan(WAREHOUSE_LOCATION_PERMISSIONS.create))) return forbidden();
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse) return notFound();
    const body = bodyOf(config);
    const name = text(body.name);
    if (!name || name.length > 100) return invalid("name", "must not be blank");
    const color = text(body.color) || null;
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return invalid("color", "must be #RRGGBB");
    const { zones } = getWarehouseStore();
    const taken = zones.some(
      (z) => z.warehouseId === warehouse.id && z.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) return fail(409, "ZONE_NAME_ALREADY_EXISTS", "This zone name is already in use");
    const zone = { id: crypto.randomUUID(), warehouseId: warehouse.id, name, color, version: 0 };
    zones.push(zone);
    return ok(zone, 201);
  });
}

export function registerWarehouseMockRoutes(): void {
  registerWarehouseRoutes();
  registerWarehouseShelfMockRoutes();
}
