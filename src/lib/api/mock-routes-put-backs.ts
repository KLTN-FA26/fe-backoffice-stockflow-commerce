/**
 * Mock routes — cất lại thùng (docs 07 §4.5), khớp BE `FulfillmentController#putBacks / #putBack`
 * + `PickListService#putBacks` + `PickList.putBack`: cất NGUYÊN THÙNG, quét LPN để xác nhận. Quyền theo mã (BE PR #148), không theo vai trò.
 * Chỉ dùng khi USE_MOCK=true.
 */

import { FULFILLMENT_PICKING_PERMISSIONS as PICKING, PICK_LINE_LIMITS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { builtCheckSessions } from "./mock-routes-carton-check-store";
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
  mockUsableAreaCodes,
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

/**
 * BE `PickList.putBackToQuarantine`: thùng hư hỏng bị loại ở trạm kiểm thùng (docs 08 §4.2 bước 4) vào khu cách ly,
 * không về bin. Thùng đã bị loại vì hư hỏng của dòng lấy hàng này (nếu có).
 */
function damagedCartonOf(taskId: string, lineId: string) {
  return builtCheckSessions()
    .get(taskId)
    ?.cartons.find(
      (carton) =>
        carton.pickLineId === lineId &&
        carton.status === "REMOVED" &&
        carton.removalReason === "DAMAGED",
    );
}

/** BE `putBackToQuarantine`: chỉ khu QUARANTINE đang hoạt động của đúng kho task. */
async function usableQuarantineOf(warehouseId: string, code: string): Promise<string | undefined> {
  const wanted = code.trim().toUpperCase();
  return (await mockUsableAreaCodes(warehouseId, "QUARANTINE")).find(
    (area) => area.toUpperCase() === wanted,
  );
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
        // Dòng Picked (đã trừ tồn) và Staged (còn ở khu chờ xuất) của task huỷ đều chờ cất lại (docs 07 §4.5 bước 13)
        if (line.status !== "PICKED" && line.status !== "STAGED") continue;
        rows.push({
          taskId: task.taskId,
          orderNumber: task.orderNumber,
          warehouseId: task.warehouseId,
          lineId: line.lineId,
          sku: line.sku,
          lotNumber: line.lotNumber,
          lpn: line.lpn,
          pickedQty: line.pickedQty,
          // Thùng Staged đang đứng ở khu chờ xuất, không ở bin đã lấy ra
          fromLocationCode:
            line.status === "STAGED"
              ? (line.stagedLocationCode ?? line.locationCode)
              : line.locationCode,
          pickedAt: line.pickedAt ?? task.assignedAt,
          quarantine: false,
        });
      }
    }
    // Thùng hư hỏng bị loại ở trạm kiểm thùng chờ vào khu cách ly (docs 08 §4.2 bước 4) — của task chưa huỷ
    for (const task of (await getFulfillmentStore()).values()) {
      if (task.pickStatus === "CANCELLED") continue;
      if (warehouseId && task.warehouseId !== warehouseId) continue;
      if (await outOfWarehouseScope(actor.userId, task.warehouseId)) continue;
      for (const line of await getMockPickLines(task)) {
        if (line.status !== "PICKED" || !damagedCartonOf(task.taskId, line.lineId)) continue;
        rows.push({
          taskId: task.taskId,
          orderNumber: task.orderNumber,
          warehouseId: task.warehouseId,
          lineId: line.lineId,
          sku: line.sku,
          lotNumber: line.lotNumber,
          lpn: line.lpn,
          pickedQty: line.pickedQty,
          // Thùng đứng ở khu xuất hàng (DISPATCH), chờ cất vào khu cách ly
          fromLocationCode: "DISPATCH",
          pickedAt: line.pickedAt ?? task.assignedAt,
          quarantine: true,
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
      const body = parseJsonBody(config.data);
      const code = readString(body.locationCode).trim();
      const lpn = readString(body.lpn).trim();
      // BE `PutBackRequest`: locationCode @NotBlank @Size(64), lpn @NotBlank @Size(30)
      const invalid = [
        ...(!code || code.length > PICK_LINE_LIMITS.codeMax
          ? [{ field: "locationCode", message: "must not be blank", code: "NotBlank" }]
          : []),
        ...(!lpn || lpn.length > PICK_LINE_LIMITS.lpnMax
          ? [{ field: "lpn", message: "must not be blank", code: "NotBlank" }]
          : []),
      ];
      if (invalid.length) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", invalid);
      }
      const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
      if (!task) return taskNotFound();
      if (await outOfWarehouseScope(actor.userId, task.warehouseId)) return outOfScope();
      const line = (await getMockPickLines(task)).find(
        (candidate) => candidate.lineId === routeParam(config, "lineId"),
      );
      if (!line) return beError(404, "NOT_FOUND", "The task has no such pick line");
      // BE `PickList.putBack` — đúng thứ tự kiểm tra
      if (line.status === "PUT_BACK" && line.lpn.toUpperCase() === lpn.toUpperCase())
        return beOk(toPickLineResponse(line));
      const damaged = damagedCartonOf(task.taskId, line.lineId);
      if (
        !damaged &&
        (task.pickStatus !== "CANCELLED" ||
          !task.needsPutBack ||
          (line.status !== "PICKED" && line.status !== "STAGED"))
      ) {
        return beError(409, "PUT_BACK_NOT_REQUIRED", "Nothing to put back");
      }
      if (line.lpn.toUpperCase() !== lpn.toUpperCase()) {
        return beError(409, "PICK_ITEM_MISMATCH", `This line puts back carton ${line.lpn}`);
      }
      // Thùng hư hỏng vào khu QUARANTINE, không về bin
      const bin = damaged
        ? await usableQuarantineOf(task.warehouseId, code)
        : await usableBinOf(task.warehouseId, code);
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
