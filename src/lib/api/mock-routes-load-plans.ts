/**
 * Mock routes — kế hoạch xếp xe (docs 09 §4.2, §5), theo hợp đồng BE PR #161 (`LoadPlanController`): đọc cần
 * `fulfillment-load-plans:READ`, lập cần `:CREATE`, mọi bước sau cần `:UPDATE` (lấy từ phiên mock như
 * `@RequiresPermission`). Mọi thay đổi gửi `expectedVersion` (409 OPTIMISTIC_LOCK); lập kế hoạch idempotent theo
 * `requestId`. Chỉnh tay `PUT …/placements` (PR F5) kiểm đủ luật BR-10 ở `mock-load-plan-edit.ts`.
 */

import { LOAD_PLAN_PERMISSIONS, LOAD_PLAN_SELECTION_MODES, LOAD_PLAN_STATUSES } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { editPlacements } from "./mock-load-plan-edit";
import * as ops from "./mock-load-plan-ops";
import { reconciliationView } from "./mock-load-plan-reconciliation";
import {
  getMockPlans,
  getMockShipments,
  heldPackageIds,
  nextLoadPlan,
} from "./mock-load-plan-store";
import { candidateView, layoutView, planDetail, planOf, planRow } from "./mock-load-plan-view";
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

import type { AxiosRequestConfig } from "axios";
import type { LoadPlanSelectionMode } from "@/constants";
import type { MockResponseShape } from "./mock-route-utils";
import type { MockPlan } from "./mock-load-plan-store";

const PATH = "/fulfillment/load-plans";
const P = LOAD_PLAN_PERMISSIONS;
type Permission = (typeof P)[keyof typeof P];

const notFound = () => fail(404, "LOAD_PLAN_NOT_FOUND", "Load plan not found");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const modeOf = (value: unknown): LoadPlanSelectionMode | null => {
  const found = LOAD_PLAN_SELECTION_MODES.find((mode) => mode === value);
  return found ?? null;
};

async function guarded(
  permission: Permission,
  handle: () => MockResponseShape,
): Promise<MockResponseShape> {
  return (await currentActor()).can(permission)
    ? handle()
    : fail(403, "FORBIDDEN", "Access denied");
}

/** Bước ghi lên một kế hoạch: tìm kế hoạch, kiểm `expectedVersion`, chạy thao tác, trả `PlanDetail` mới. */
function step(
  pattern: string,
  run: (
    plan: MockPlan,
    body: Record<string, unknown>,
    config: AxiosRequestConfig,
  ) => MockResponseShape | null,
): void {
  registerMockRoute("POST", pattern, (config) =>
    guarded(P.update, () => {
      const plan = planOf(routeParam(config, "id"));
      if (!plan) return notFound();
      const body = parseJsonBody(config.data);
      if (body.expectedVersion !== plan.version)
        return fail(409, "OPTIMISTIC_LOCK", `Load plan ${plan.code} changed meanwhile; reload it`);
      return run(plan, body, config) ?? ok(planDetail(plan));
    }),
  );
}

export function registerLoadPlanMockRoutes(): void {
  registerMockRoute("GET", "/fulfillment/load-plan-candidates", (config) =>
    guarded(P.read, () => {
      const params = readParams(config);
      const warehouseId = readString(params.warehouseId);
      if (!warehouseId) return invalid("warehouseId", "must not be null");
      const held = heldPackageIds(readString(params.loadPlanId) || undefined);
      const rows = getMockShipments()
        .filter((s) => s.warehouseId === warehouseId)
        .map((s) => candidateView(s, held))
        // Lô mà mọi kiện đều thuộc kế hoạch khác thì không còn là ứng viên
        .filter((candidate) => candidate.packages.length > 0);
      return ok(rows);
    }),
  );

  registerMockRoute("POST", PATH, (config) =>
    guarded(P.create, () => {
      const body = parseJsonBody(config.data);
      const requestId = readString(body.requestId);
      const warehouseId = readString(body.warehouseId);
      if (!requestId) return invalid("requestId", "must not be null");
      if (!warehouseId) return invalid("warehouseId", "must not be null");
      const plans = getMockPlans();
      const replay = [...plans.values()].find((plan) => plan.requestId === requestId);
      if (replay) return ok(planDetail(replay), 201);
      const mode = body.selectionMode === undefined ? "SINGLE_TYPE" : modeOf(body.selectionMode);
      if (!mode) return invalid("selectionMode", "must be SINGLE_TYPE or FEWEST_VEHICLES");
      const shipmentIds = strings(body.shipmentIds);
      const vehicleTypeIds = strings(body.vehicleTypeIds);
      const refused = ops.checkInputs(warehouseId, shipmentIds, vehicleTypeIds);
      if (refused) return refused;
      const { loadPlanId, code } = nextLoadPlan();
      const plan: MockPlan = {
        loadPlanId,
        code,
        requestId,
        warehouseId,
        selectionMode: mode,
        status: "DRAFT",
        note: readString(body.note) || null,
        vehicleTypeIds,
        shipmentIds,
        vehicles: [],
        unplaced: new Map(),
        leftBehind: [],
        acknowledgement: null,
        createdAt: new Date().toISOString(),
        calculatedAt: null,
        confirmedAt: null,
        reopenedAt: null,
        reopenReason: null,
        cancelledAt: null,
        cancelReason: null,
        version: 0,
      };
      plans.set(loadPlanId, plan);
      return ok(planDetail(plan), 201);
    }),
  );

  registerMockRoute("GET", PATH, (config) =>
    guarded(P.read, () => {
      const params = readParams(config);
      const status = readString(params.status).toUpperCase();
      const search = readString(params.search).toUpperCase();
      const warehouseId = readString(params.warehouseId);
      if (status && !LOAD_PLAN_STATUSES.some((known) => known === status))
        return invalid("status", "unknown status");
      const size = Math.min(
        BE_MAX_PAGE_SIZE,
        Math.max(1, readInt(params.size, BE_DEFAULT_PAGE_SIZE)),
      );
      const rows = [...getMockPlans().values()]
        .filter((plan) => !warehouseId || plan.warehouseId === warehouseId)
        .filter((plan) => !status || plan.status === status)
        .filter((plan) => !search || plan.code.toUpperCase().includes(search))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(planRow);
      return ok(bePage(rows, Math.max(0, readInt(params.page, 0)), size));
    }),
  );

  registerMockRoute("GET", `${PATH}/:id`, (config) =>
    guarded(P.read, () => {
      const plan = planOf(routeParam(config, "id"));
      return plan ? ok(planDetail(plan)) : notFound();
    }),
  );

  registerMockRoute("GET", `${PATH}/:id/layouts`, (config) =>
    guarded(P.read, () => {
      const plan = planOf(routeParam(config, "id"));
      return plan ? ok(plan.vehicles.map(layoutView)) : notFound();
    }),
  );

  registerMockRoute("GET", `${PATH}/:id/vehicles/:seq/layout`, (config) =>
    guarded(P.read, () => {
      const plan = planOf(routeParam(config, "id"));
      if (!plan) return notFound();
      const vehicle = plan.vehicles.find((v) => v.seq === Number(routeParam(config, "seq")));
      return vehicle
        ? ok(layoutView(vehicle))
        : fail(404, "LOAD_PLAN_VEHICLE_NOT_FOUND", "This vehicle is not in the load plan");
    }),
  );

  registerMockRoute("GET", `${PATH}/:id/reconciliation`, (config) =>
    guarded(P.read, () => {
      const plan = planOf(routeParam(config, "id"));
      return plan ? ok(reconciliationView(plan)) : notFound();
    }),
  );

  registerMockRoute("PUT", `${PATH}/:id/inputs`, (config) =>
    guarded(P.update, () => {
      const plan = planOf(routeParam(config, "id"));
      if (!plan) return notFound();
      const body = parseJsonBody(config.data);
      if (body.expectedVersion !== plan.version)
        return fail(409, "OPTIMISTIC_LOCK", `Load plan ${plan.code} changed meanwhile; reload it`);
      const mode =
        body.selectionMode === undefined ? plan.selectionMode : modeOf(body.selectionMode);
      if (!mode) return invalid("selectionMode", "must be SINGLE_TYPE or FEWEST_VEHICLES");
      const refused = ops.setInputs(plan, {
        shipmentIds: strings(body.shipmentIds),
        vehicleTypeIds: strings(body.vehicleTypeIds),
        selectionMode: mode,
      });
      return refused ?? ok(planDetail(plan));
    }),
  );

  registerMockRoute("PUT", `${PATH}/:id/placements`, (config) =>
    guarded(P.update, () => {
      const plan = planOf(routeParam(config, "id"));
      if (!plan) return notFound();
      const body = parseJsonBody(config.data);
      if (body.expectedVersion !== plan.version)
        return fail(409, "OPTIMISTIC_LOCK", `Load plan ${plan.code} changed meanwhile; reload it`);
      return editPlacements(plan, body) ?? ok(planDetail(plan));
    }),
  );
  step(`${PATH}/:id/calculation`, (plan) => ops.calculate(plan));
  step(`${PATH}/:id/vehicles/:seq/recalculation`, (plan, body, config) =>
    ops.recalculateVehicle(plan, Number(routeParam(config, "seq")), strings(body.addPackageIds)),
  );
  step(`${PATH}/:id/unplaced-acknowledgement`, (plan, body) =>
    ops.acknowledgeUnplaced(plan, readString(body.note) || null),
  );
  step(`${PATH}/:id/confirmation`, (plan) => ops.confirm(plan));
  step(`${PATH}/:id/reopening`, (plan, body) => ops.reopen(plan, readString(body.reason)));
  step(`${PATH}/:id/cancellation`, (plan, body) => ops.cancel(plan, readString(body.reason)));
}
