/**
 * Mock routes — danh mục loại xe (docs 09 §3), theo hợp đồng BE PR #153 (`VehicleTypeController`,
 * `VehicleTypeService`): đọc cần `fulfillment-vehicle-types:READ`, tạo / sửa cần `:UPDATE` (lấy từ phiên
 * mock như `@RequiresPermission`). Mã viết hoa và không đổi; không có DELETE; sửa kèm `version` (409
 * OPTIMISTIC_LOCK); `gussetMm` / `status` vắng = tạo mới lấy 0 / ACTIVE, sửa giữ nguyên; `rentalPrice` vắng = xoá.
 */

import {
  VEHICLE_TYPE_KIND,
  VEHICLE_TYPE_KINDS,
  VEHICLE_TYPE_LIMITS,
  VEHICLE_TYPE_PERMISSIONS,
  VEHICLE_TYPE_STATUS,
  VEHICLE_TYPE_STATUSES,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { fail, ok } from "./mock-route-utils";
import { currentActor, routeParam } from "./mock-routes-fulfillment-store";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  bePage,
  parseJsonBody,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";
import { getVehicleTypeStore, nextVehicleTypeId } from "./mock-vehicle-type-store";

import type { AxiosRequestConfig } from "axios";
import type { MockResponseShape } from "./mock-route-utils";
import type {
  MockVehicleKind,
  MockVehicleStatus,
  MockVehicleType,
} from "./mock-vehicle-type-store";

const PATH = "/fulfillment/vehicle-types";
// `includes` trên chuỗi người dùng gửi lên nên nới kiểu tuple về `readonly string[]`
const KINDS: readonly string[] = VEHICLE_TYPE_KINDS;
const STATUSES: readonly string[] = VEHICLE_TYPE_STATUSES;
const CODE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const L = VEHICLE_TYPE_LIMITS;

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const notFound = () => fail(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found");

type Problems = { field: string; message: string }[];

const intIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** `VehicleTypeService.fill`: kiểm các trường dùng chung; trả bản ghi mới + danh sách lỗi theo trường. */
function fill(
  body: Record<string, unknown>,
  row: MockVehicleType,
): { next: MockVehicleType; problems: Problems } {
  const problems: Problems = [];
  const name = readString(body.name);
  if (!name || name.length > L.nameMax)
    problems.push({ field: "name", message: "required, at most 120 characters" });
  const kind = readString(body.kind).toUpperCase();
  if (!KINDS.includes(kind))
    problems.push({ field: "kind", message: "CONTAINER, TRUCK or PICKUP" });
  const sides = (["innerLengthMm", "innerWidthMm", "innerHeightMm"] as const).map((field) => {
    const ok = intIn(body[field], 1, L.dimensionMaxMm);
    if (!ok) problems.push({ field, message: `1 to ${L.dimensionMaxMm} mm` });
    return ok ? (body[field] as number) : 1;
  });
  const gusset =
    body.gussetMm === undefined || body.gussetMm === null ? row.gussetMm : body.gussetMm;
  if (!intIn(gusset, 0, L.gussetMaxMm))
    problems.push({ field: "gussetMm", message: `0 to ${L.gussetMaxMm} mm` });
  const payload = body.maxPayloadKg;
  const payloadOk = typeof payload === "number" && payload > 0 && payload <= L.payloadMaxKg;
  if (!payloadOk)
    problems.push({ field: "maxPayloadKg", message: "more than 0 and at most 100000 kg" });
  if (!intIn(body.availableCount, 0, L.availableCountMax))
    problems.push({ field: "availableCount", message: `0 to ${L.availableCountMax}` });
  const price = typeof body.rentalPrice === "number" ? body.rentalPrice : null;
  if (price !== null && price < 0) problems.push({ field: "rentalPrice", message: "0 or more" });
  const status = readString(body.status).toUpperCase() || row.status;
  if (!STATUSES.includes(status)) problems.push({ field: "status", message: "ACTIVE or INACTIVE" });
  return {
    problems,
    next: {
      ...row,
      name,
      kind: kind as MockVehicleKind,
      innerLengthMm: sides[0] ?? 1,
      innerWidthMm: sides[1] ?? 1,
      innerHeightMm: sides[2] ?? 1,
      gussetMm: typeof gusset === "number" ? gusset : 0,
      maxPayloadKg: payloadOk ? payload : 1,
      availableCount: typeof body.availableCount === "number" ? body.availableCount : 0,
      rentalPrice: price,
      status: status as MockVehicleStatus,
    },
  };
}

const invalid = (problems: Problems) =>
  fail(400, "VALIDATION_FAILED", "Invalid vehicle type", problems);

const page = (rows: readonly MockVehicleType[], config: AxiosRequestConfig) => {
  const params = readParams(config);
  const size = Math.min(BE_MAX_PAGE_SIZE, Math.max(1, readInt(params.size, BE_DEFAULT_PAGE_SIZE)));
  return ok(bePage(rows, Math.max(0, readInt(params.page, 0)), size));
};

async function guarded(
  permission: (typeof VEHICLE_TYPE_PERMISSIONS)[keyof typeof VEHICLE_TYPE_PERMISSIONS],
  handle: () => MockResponseShape,
): Promise<MockResponseShape> {
  return (await currentActor()).can(permission) ? handle() : forbidden();
}

export function registerVehicleTypeMockRoutes(): void {
  registerMockRoute("GET", PATH, (config) =>
    guarded(VEHICLE_TYPE_PERMISSIONS.read, () => {
      const params = readParams(config);
      const status = readString(params.status).toUpperCase();
      const search = readString(params.search).toUpperCase();
      if (status && !STATUSES.includes(status))
        return invalid([{ field: "status", message: "ACTIVE or INACTIVE" }]);
      const rows = [...getVehicleTypeStore().values()]
        .filter((row) => !status || row.status === status)
        .filter((row) => !search || `${row.code} ${row.name}`.toUpperCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
      return page(rows, config);
    }),
  );

  registerMockRoute("GET", `${PATH}/:id`, (config) =>
    guarded(VEHICLE_TYPE_PERMISSIONS.read, () => {
      const row = getVehicleTypeStore().get(routeParam(config, "id"));
      return row ? ok(row) : notFound();
    }),
  );

  registerMockRoute("POST", PATH, (config) =>
    guarded(VEHICLE_TYPE_PERMISSIONS.update, () => {
      const body = parseJsonBody(config.data);
      const code = readString(body.code).toUpperCase();
      if (!CODE.test(code))
        return invalid([{ field: "code", message: "2-32 letters, digits, '-' or '_'" }]);
      const store = getVehicleTypeStore();
      if ([...store.values()].some((row) => row.code === code))
        return fail(409, "VEHICLE_TYPE_CODE_EXISTS", `Vehicle type code ${code} is taken`);
      const created: MockVehicleType = {
        vehicleTypeId: nextVehicleTypeId(),
        code,
        name: "",
        kind: VEHICLE_TYPE_KIND.TRUCK,
        innerLengthMm: 1,
        innerWidthMm: 1,
        innerHeightMm: 1,
        gussetMm: 0,
        maxPayloadKg: 1,
        availableCount: 0,
        rentalPrice: null,
        preset: false,
        status: VEHICLE_TYPE_STATUS.ACTIVE,
        version: 0,
      };
      const { next, problems } = fill(body, created);
      if (problems.length > 0) return invalid(problems);
      store.set(next.vehicleTypeId, next);
      return ok(next, 201);
    }),
  );

  registerMockRoute("PUT", `${PATH}/:id`, (config) =>
    guarded(VEHICLE_TYPE_PERMISSIONS.update, () => {
      const store = getVehicleTypeStore();
      const row = store.get(routeParam(config, "id"));
      if (!row) return notFound();
      const body = parseJsonBody(config.data);
      const code = readString(body.code).toUpperCase();
      if (code && code !== row.code)
        return invalid([{ field: "code", message: "cannot be changed" }]);
      if (body.version !== row.version)
        return fail(
          409,
          "OPTIMISTIC_LOCK",
          `Vehicle type ${row.code} changed meanwhile; reload it`,
        );
      const { next, problems } = fill(body, row);
      if (problems.length > 0) return invalid(problems);
      const saved = { ...next, version: row.version + 1 };
      store.set(saved.vehicleTypeId, saved);
      return ok(saved);
    }),
  );
}
