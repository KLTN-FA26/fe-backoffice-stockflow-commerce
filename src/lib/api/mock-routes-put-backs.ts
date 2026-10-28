/**
 * Mock routes — trả hàng về kệ (SCRUM-275), khớp BE `FulfillmentController#putBacks / #putBack`
 * + `PickListService#putBacks` + `PickList.putBack`. Quyền theo mã (BE PR #148), không theo vai trò.
 * Chỉ dùng khi USE_MOCK=true.
 */

import { FULFILLMENT_PICKING_PERMISSIONS as PICKING, PICK_LINE_LIMITS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  currentActor,
  forbidden,
  getFulfillmentStore,
  outOfScope,
  outOfWarehouseScope,
  routeParam,
  taskNotFound,
} from "./mock-routes-fulfillment-store";
import {
  getMockPickLines,
  toPickLineResponse,
  withIdempotency,
} from "./mock-routes-pick-lines-store";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  beError,
  beOk,
  bePage,
  parseJsonBody,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";
import {
  isMockLocationUsable,
  mockLocationCode,
  mockWarehouseLocations,
} from "./mock-routes-warehouse-layout";

/** BE `PickList.putBack`: chỉ bin đang hoạt động của đúng kho task (khu chứa / kho khác → lỗi). */
async function usableBinOf(warehouseId: string, code: string): Promise<string | undefined> {
  const wanted = code.trim().toUpperCase();
  const bin = (await mockWarehouseLocations(warehouseId)).find(
    (location) =>
      location.type === "bin" &&
      isMockLocationUsable(location) &&
      mockLocationCode(location).toUpperCase() === wanted,
  );
  return bin ? mockLocationCode(bin) : undefined;
}

function registerQueueRoute(): void {
  registerMockRoute("GET", "/fulfillment/put-backs", async (config) => {
    const actor = await currentActor();
    if (!actor.can(PICKING.read)) return forbidden();
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    const warehouseId = readString(params.warehouseId);
    if (warehouseId && (await outOfWarehouseScope(actor.userId, warehouseId))) return outOfScope();
    const rows = [];
    for (const task of (await getFulfillmentStore()).values()) {
      if (task.pickStatus !== "CANCELLED" || !task.needsPutBack) continue;
      if (warehouseId && task.warehouseId !== warehouseId) continue;
      // Không lọc kho → chỉ các kho trong phạm vi người gọi (BE `WarehouseScope.restriction`)
      if (await outOfWarehouseScope(actor.userId, task.warehouseId)) continue;
      for (const line of await getMockPickLines(task)) {
        if (line.status !== "PICKED") continue;
        rows.push({
          taskId: task.taskId,
          orderNumber: task.orderNumber,
          warehouseId: task.warehouseId,
          lineId: line.lineId,
          sku: line.sku,
          lotNumber: line.lotNumber,
          pickedQty: line.pickedQty,
          fromLocationCode: line.locationCode,
          pickedAt: line.pickedAt ?? task.assignedAt,
        });
      }
    }
    // Cũ nhất trước (BE sắp pickedAt, id)
    rows.sort((a, b) => a.pickedAt.localeCompare(b.pickedAt) || a.lineId.localeCompare(b.lineId));
    return beOk(bePage(rows, page, size));
  });
}

function registerPutBackRoute(): void {
  registerMockRoute("POST", "/fulfillment/tasks/:id/pick-lines/:lineId/put-back", (config) =>
    withIdempotency(config, async () => {
      const actor = await currentActor();
      if (!actor.can(PICKING.update)) return forbidden();
      const code = readString(parseJsonBody(config.data).locationCode).trim();
      if (!code || code.length > PICK_LINE_LIMITS.codeMax) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "locationCode", message: "must not be blank", code: "NotBlank" },
        ]);
      }
      const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
      if (!task) return taskNotFound();
      if (await outOfWarehouseScope(actor.userId, task.warehouseId)) return outOfScope();
      const line = (await getMockPickLines(task)).find(
        (candidate) => candidate.lineId === routeParam(config, "lineId"),
      );
      if (!line) return beError(404, "NOT_FOUND", "The task has no such pick line");
      // BE `PickList.putBack` — đúng thứ tự kiểm tra
      if (line.status === "PUT_BACK") return beOk(toPickLineResponse(line));
      if (task.pickStatus !== "CANCELLED" || !task.needsPutBack || line.status !== "PICKED") {
        return beError(409, "PUT_BACK_NOT_REQUIRED", "Nothing to put back");
      }
      const bin = await usableBinOf(task.warehouseId, code);
      if (!bin) {
        return beError(
          409,
          "PUT_BACK_LOCATION_INVALID",
          "Goods go back onto an active bin of this task's warehouse",
        );
      }
      line.status = "PUT_BACK";
      line.putBackQty = line.pickedQty;
      line.putBackLocationCode = bin;
      line.putBackAt = new Date().toISOString();
      return beOk(toPickLineResponse(line));
    }),
  );
}

export function registerPutBackMockRoutes(): void {
  registerQueueRoute();
  registerPutBackRoute();
}
