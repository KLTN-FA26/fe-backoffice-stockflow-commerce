/**
 * Mock routes — chuyến xe (module 09) theo CONTRACT ĐỀ XUẤT SCRUM-288 (xem features/shipping/api.ts).
 * Chỉ dùng khi USE_MOCK=true. Trả đúng errorCode đề xuất để FE map lỗi tiếng Việt.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  MOCK_LOADER,
  getLoadStore,
  invalidLoadTransition,
  isKnownPackageCode,
  loadNotFound,
  toLoadResponse,
} from "./mock-routes-loads-store";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  beError,
  beOk,
  bePage,
  parseJsonBody,
  readInt,
  readParams,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { MockLoad } from "./mock-routes-loads-store";

const PATH = "/fulfillment/loads";
const ITEM = `${PATH}/:id`;

const toList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map(readString).filter(Boolean);

const toRow = (load: MockLoad) => {
  const { lines: _lines, manifest: _manifest, version: _version, ...row } = toLoadResponse(load);
  return row;
};

/** Tìm chuyến theo id route; không có → 404 LOAD_NOT_FOUND. */
async function withLoad(
  config: AxiosRequestConfig,
  apply: (load: MockLoad) => MockLoad | ReturnType<typeof beError>,
) {
  const store = await getLoadStore();
  const id = readRouteId(config);
  const load = store.get(id);
  if (!load) return loadNotFound(id);
  const result = apply(load);
  if (!("loadId" in result)) return result;
  const saved = { ...result, version: load.version + 1 };
  store.set(id, saved);
  return beOk(toLoadResponse(saved));
}

export function registerLoadMockRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const params = readParams(config);
    const statuses = toList(params.status);
    const search = readString(params.search).toUpperCase();
    const items = [...(await getLoadStore()).values()]
      .filter((l) => statuses.length === 0 || statuses.includes(l.status))
      .filter(
        (l) =>
          !search ||
          l.number.toUpperCase().includes(search) ||
          (l.vehiclePlate ?? "").toUpperCase().includes(search),
      )
      .map(toRow);
    const size = Math.min(BE_MAX_PAGE_SIZE, readInt(params.size, BE_DEFAULT_PAGE_SIZE));
    return beOk(bePage(items, readInt(params.page, 0), size));
  });

  registerMockRoute("GET", ITEM, async (config) => {
    const id = readRouteId(config);
    const load = (await getLoadStore()).get(id);
    return load ? beOk(toLoadResponse(load)) : loadNotFound(id);
  });

  // 03 §11: VEHICLE_BOOKED → LOADING khi xe tới dock
  registerMockRoute("POST", `${ITEM}/loading-start`, (config) =>
    withLoad(config, (load) =>
      load.status === "VEHICLE_BOOKED"
        ? { ...load, status: "LOADING" }
        : invalidLoadTransition(load.status, "start loading"),
    ),
  );

  // F-SHP bước 04: chặn kiện không thuộc chuyến
  registerMockRoute("POST", `${ITEM}/scans`, (config) =>
    withLoad(config, (load) => {
      if (load.status !== "LOADING") return invalidLoadTransition(load.status, "scan packages");
      const code = readString(parseJsonBody(config.data).packageCode).toUpperCase();
      const line = load.lines.find((l) => l.packageCode.toUpperCase() === code);
      if (!line) {
        return isKnownPackageCode(code)
          ? beError(409, "PACKAGE_NOT_IN_LOAD", `Package ${code} is not planned on ${load.number}`)
          : beError(404, "PACKAGE_NOT_FOUND", `Package ${code} not found`);
      }
      if (line.loadedAt) {
        return beError(409, "PACKAGE_ALREADY_LOADED", `Package ${code} is already on the vehicle`);
      }
      const loadedAt = new Date().toISOString();
      return {
        ...load,
        lines: load.lines.map((l) =>
          l.loadLineId === line.loadLineId ? { ...l, loadedAt, loadedBy: MOCK_LOADER } : l,
        ),
      };
    }),
  );

  // 03 §11: LOADING → DISPATCHED khi đủ kiện + biên bản ký; BR-03 order → SHIPPED ở BE
  registerMockRoute("POST", `${ITEM}/handover`, (config) =>
    withLoad(config, (load) => {
      if (load.status !== "LOADING") return invalidLoadTransition(load.status, "hand over");
      const body = parseJsonBody(config.data);
      if (readInt(body.version, -1) !== load.version) {
        return beError(409, "OPTIMISTIC_LOCK", "The load changed since you read it");
      }
      if (load.lines.some((l) => !l.loadedAt)) {
        return beError(409, "LOAD_NOT_FULLY_LOADED", "Every planned package must be loaded first");
      }
      const carrierRepresentative = readString(body.carrierRepresentative);
      if (!carrierRepresentative) {
        return beError(400, "VALIDATION_FAILED", "carrierRepresentative is required");
      }
      // Guard "manifest signed" (BE 03 §11): chưa xác nhận ký biên bản thì không bàn giao
      if (body.signed !== true) {
        return beError(
          400,
          "VALIDATION_FAILED",
          "The paper manifest must be signed by both parties",
        );
      }
      const handedOverAt = new Date().toISOString();
      return {
        ...load,
        status: "DISPATCHED",
        dispatchedAt: handedOverAt,
        manifest: {
          manifestNumber: `MNF-${load.number.slice(5)}`,
          carrierRepresentative,
          note: readString(body.note) || null,
          handedOverBy: MOCK_LOADER,
          handedOverAt,
        },
      };
    }),
  );
}
