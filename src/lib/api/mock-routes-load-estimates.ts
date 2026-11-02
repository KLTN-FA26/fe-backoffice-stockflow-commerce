/**
 * Mock routes — ước tính xếp xe (SCRUM-287 PR EST, BE PR #160 `LoadEstimateController`):
 *
 * - POST /fulfillment/load-estimates {sources:[{type:"ORDER", id}], warehouseId?, vehicleTypeIds, selectionMode}
 *   → 201; cần `fulfillment-load-estimates:CREATE`. Đơn CONFIRMED bắt buộc `warehouseId` (400 NotNull); đơn đã release
 *   dùng kho của nó (kho khác → 400 WarehouseMismatch); trạng thái không ước tính được → 409
 *   LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE; loại xe lạ 404 / ngừng dùng 409; một lần ước tính mới thay bản hiện hành.
 * - POST /fulfillment/load-estimates/trial → 200, không lưu; cần `:CREATE` (xem `mock-load-estimate-trial.ts`).
 * - GET /fulfillment/load-estimates?sourceType=ORDER&sourceId= → ước tính hiện hành; cần `:READ`; 404
 *   LOAD_ESTIMATE_NOT_FOUND khi chưa có.
 *
 * Kết quả dựng ở `mock-load-estimate-builder.ts` từ fixture `Layout` của F1.
 */

import { LOAD_ESTIMATE_LIMITS, LOAD_ESTIMATE_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { buildMockEstimate } from "./mock-load-estimate-builder";
import { fail, ok } from "./mock-route-utils";
import { backendStatus, seedLifecycle } from "./mock-routes-orders";
import { parseJsonBody, readParams, readString } from "./mock-routes-purchase-orders-store";
import { mockTrialEstimate } from "./mock-load-estimate-trial";
import { mockGrantsOf } from "./mock-user-grants";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "@/lib/mock-data";
import type { MockEstimate } from "./mock-load-estimate-builder";
import type { MockResponseShape } from "./mock-route-utils";

/** BE `LoadEstimateService`: CONFIRMED (kèm kho) và các trạng thái đã release còn hàng để giao. */
const ESTIMABLE = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PACKED",
  "PARTIALLY_FULFILLED",
];

const current = new Map<string, MockEstimate>();
let sequence = 0;

export function resetLoadEstimateMockStore(): void {
  current.clear();
  sequence = 0;
}

const validation = (field: string, code: string, message: string) =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message, code }]);

async function can(code: PermissionCode): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(code);
}

async function findOrder(id: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((o) => o.orderId === id);
}

/** Kiểm yêu cầu như BE: nguồn, trạng thái, kho, loại xe. Trả lỗi, hoặc kho sẽ dùng. */
async function checkRequest(
  order: Order,
  body: Record<string, unknown>,
): Promise<MockResponseShape | { warehouseId: string }> {
  const status = backendStatus(order);
  if (!ESTIMABLE.includes(status))
    return fail(
      409,
      "LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE",
      `Order ${order.orderNumber} is ${status}`,
    );
  const requested = readString(body.warehouseId);
  let warehouseId: string;
  if (status === "CONFIRMED") {
    if (!requested)
      return validation(
        "warehouseId",
        "NotNull",
        "is required for an order that is not released yet",
      );
    const { warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((w) => w.warehouseId === requested))
      return fail(404, "NOT_FOUND", `No warehouse ${requested}`);
    warehouseId = requested;
  } else {
    warehouseId = seedLifecycle(order).warehouseId ?? order.fulfillmentWarehouseId;
    if (requested && requested !== warehouseId)
      return validation(
        "warehouseId",
        "WarehouseMismatch",
        "must be the order's warehouse, or left out",
      );
  }
  const ids = Array.isArray(body.vehicleTypeIds) ? body.vehicleTypeIds : [];
  if (ids.length > LOAD_ESTIMATE_LIMITS.vehicleTypesMax)
    return validation("vehicleTypeIds", "Size", "at most 20 vehicle types");
  const types = getVehicleTypeStore();
  for (const id of ids) {
    const type = typeof id === "string" ? types.get(id) : undefined;
    if (!type) return fail(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found");
    if (type.status !== "ACTIVE")
      return fail(409, "VEHICLE_TYPE_INACTIVE", `${type.code} is not in use`);
  }
  return { warehouseId };
}

export function registerLoadEstimateMockRoutes(): void {
  registerMockRoute("POST", "/fulfillment/load-estimates", async (config) => {
    if (!(await can(LOAD_ESTIMATE_PERMISSIONS.create)))
      return fail(403, "FORBIDDEN", "Access denied");
    const body = parseJsonBody(config.data);
    const [source] = Array.isArray(body.sources) ? body.sources : [];
    const orderId = readString((source as Record<string, unknown> | undefined)?.id);
    const order = orderId ? await findOrder(orderId) : undefined;
    if (!order) return fail(404, "NOT_FOUND", "Resource not found");
    const checked = await checkRequest(order, body);
    if ("status" in checked) return checked;
    sequence += 1;
    const estimate = await buildMockEstimate(order, body, checked.warehouseId, sequence);
    current.set(order.orderId, estimate);
    return ok(estimate, 201);
  });

  registerMockRoute("POST", "/fulfillment/load-estimates/trial", async (config) => {
    if (!(await can(LOAD_ESTIMATE_PERMISSIONS.create)))
      return fail(403, "FORBIDDEN", "Access denied");
    return mockTrialEstimate(parseJsonBody(config.data));
  });

  registerMockRoute("GET", "/fulfillment/load-estimates", async (config) => {
    if (!(await can(LOAD_ESTIMATE_PERMISSIONS.read)))
      return fail(403, "FORBIDDEN", "Access denied");
    const sourceId = readString(readParams(config).sourceId);
    const estimate = current.get(sourceId);
    return estimate
      ? ok(estimate)
      : fail(404, "LOAD_ESTIMATE_NOT_FOUND", "Load estimate not found");
  });
}
