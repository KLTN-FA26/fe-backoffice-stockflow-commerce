/**
 * Mock routes — cất hàng (docs 05), khớp BE `PutawayController` + `PutawayService`: danh sách theo kho / phiếu nhập,
 * chi tiết kèm bin gợi ý tính lúc xem, xác nhận cất nguyên thùng (lỗi đúng thứ tự BE kiểm). Quyền theo mã. Mock không
 * mô phỏng phạm vi kho của kho bản đồ (module 06) — staff mock chỉ gắn kho của mock-data cũ. Chỉ dùng khi
 * USE_MOCK=true.
 */

import { PUTAWAY_LIMITS, PUTAWAY_TASK_PERMISSIONS as P } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { mockWarehouseCodeOf } from "./mock-inventory-cartons";
import {
  areasOfWarehouse,
  binsOfWarehouse,
  cartonOf,
  closeReceiptIfDone,
  findPutawayTask,
  freeOf,
  listPutawayTasks,
  suggestionsFor,
  takes,
} from "./mock-putaway-store";
import { tripCarrying } from "./mock-putaway-trips-store";
import { currentActor, forbidden } from "./mock-routes-fulfillment-store";
import { withIdempotency } from "./mock-routes-pick-lines-store";
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
import { getWarehouseStore } from "./mock-warehouse-store";

import type { MockFieldError } from "./mock-routes-purchase-orders-store";
import type { MockPutawayTask } from "./mock-putaway-store";

const upper = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

/** BE `PutawayTaskResponse` — `withSuggestions` chỉ ở chi tiết (danh sách luôn `[]`). */
export async function toResponse(task: MockPutawayTask, withSuggestions: boolean) {
  const carton = await cartonOf(task);
  const sourceLocationCode = carton?.pkg.locationCode ?? "";
  const open = task.status === "PENDING";
  const suggestions = withSuggestions && open ? await suggestionsFor(task, sourceLocationCode) : [];
  const overflow =
    withSuggestions && open && suggestions.length === 0
      ? areasOfWarehouse(mockWarehouseCodeOf(sourceLocationCode))
          .filter((area) => area.type === "OVERFLOW" && area.usable)
          .map((area) => area.locationCode)
      : [];
  return {
    id: task.id,
    goodsReceiptId: task.goodsReceiptId,
    goodsReceiptLineId: task.goodsReceiptLineId,
    sku: task.sku,
    lotNumber: task.lotNumber,
    quantity: task.quantity,
    left: task.status === "DONE" ? 0 : task.quantity,
    sourceLocationCode,
    lpn: task.lpn,
    status: task.status,
    targetLocationCode: task.targetLocationCode,
    suggestions,
    overflowLocationCodes: overflow,
    source: task.source,
  };
}

/** Kho của nhiệm vụ = kho nơi thùng đang đứng (BE lọc `warehouseId` theo vị trí thùng). */
function warehouseIdOfCode(code: string): string | undefined {
  const prefix = mockWarehouseCodeOf(code);
  return [...getWarehouseStore().warehouses.values()].find((w) => upper(w.prefix) === prefix)?.id;
}

function registerList(): void {
  registerMockRoute("GET", "/putaway-tasks", async (config) => {
    if (!(await currentActor()).can(P.read)) return forbidden();
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    const receiptId = readString(params.receiptId);
    const warehouseId = readString(params.warehouseId);
    if (!receiptId && !warehouseId) {
      return beError(400, "VALIDATION_FAILED", "Give a receiptId or a warehouseId");
    }
    const rows = [];
    for (const task of await listPutawayTasks()) {
      if (receiptId) {
        if (task.goodsReceiptId !== receiptId) continue;
      } else {
        // Theo kho: chỉ PENDING / IN_PROGRESS có thùng đang ở kho đó
        if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") continue;
        const carton = await cartonOf(task);
        if (!carton || warehouseIdOfCode(carton.pkg.locationCode ?? "") !== warehouseId) continue;
      }
      rows.push(await toResponse(task, false));
    }
    return beOk(bePage(rows, page, size));
  });
}

function registerDetail(): void {
  registerMockRoute("GET", "/putaway-tasks/:id", async (config) => {
    if (!(await currentActor()).can(P.read)) return forbidden();
    const task = await findPutawayTask(readRouteId(config));
    if (!task) return beError(404, "PUTAWAY_TASK_NOT_FOUND", "No putaway task");
    return beOk(await toResponse(task, true));
  });
}

/** BE `PutawayConfirmRequest`: lpn @NotBlank @Size(max=30), locationCode @NotBlank @Size(max=64). */
function validate(lpn: string, locationCode: string): MockFieldError[] {
  const errors: MockFieldError[] = [];
  if (!lpn.trim()) errors.push({ field: "lpn", message: "must not be blank", code: "NotBlank" });
  else if (lpn.length > PUTAWAY_LIMITS.lpnMax)
    errors.push({ field: "lpn", message: "size must be at most 30", code: "Size" });
  if (!locationCode.trim())
    errors.push({ field: "locationCode", message: "must not be blank", code: "NotBlank" });
  else if (locationCode.length > PUTAWAY_LIMITS.codeMax)
    errors.push({ field: "locationCode", message: "size must be at most 64", code: "Size" });
  return errors;
}

/** Luật cứng trên vị trí quét được, đúng thứ tự BE `PutawayService#putAway` (docs 05 §4.4 bước 8, BR-03/04/13). */
export async function checkTarget(task: MockPutawayTask, from: string, code: string) {
  const warehouseCode = mockWarehouseCodeOf(from);
  const allBins = [...getWarehouseStore().warehouses.values()].flatMap((w) =>
    binsOfWarehouse(w.prefix),
  );
  const allAreas = [...getWarehouseStore().warehouses.values()].flatMap((w) =>
    areasOfWarehouse(w.prefix),
  );
  const bin = allBins.find((b) => upper(b.locationCode) === upper(code));
  const area = allAreas.find((a) => upper(a.locationCode) === upper(code));
  if (!bin && !area) return beError(404, "LOCATION_NOT_FOUND", "No such location");
  if (area && area.type !== "OVERFLOW") {
    return beError(422, "PUTAWAY_TARGET_NOT_BIN", "Put away into a bin or an OVERFLOW area");
  }
  if (mockWarehouseCodeOf(code) !== warehouseCode) {
    return beError(
      409,
      "MOVE_ACROSS_WAREHOUSES",
      "Stock moves only between locations of one warehouse",
    );
  }
  if (area) {
    if (!area.usable) return beError(409, "LOCATION_NOT_USABLE", "The location is not usable");
    const best = (await suggestionsFor(task, from))[0];
    if (best) {
      return beError(
        409,
        "PUTAWAY_OVERFLOW_NOT_ALLOWED",
        "A bin still takes the carton",
        undefined,
        {
          locationCode: best.locationCode,
        },
      );
    }
    return { locationCode: area.locationCode };
  }
  if (!bin || !bin.usable || !bin.putawayTarget) {
    return beError(409, "LOCATION_NOT_USABLE", "The location is not usable");
  }
  if (!takes(await freeOf(bin), task.quantity)) {
    return beError(409, "LOCATION_CAPACITY_EXCEEDED", "The bin has no room for the carton");
  }
  return { locationCode: bin.locationCode };
}

function registerConfirm(): void {
  registerMockRoute("POST", "/putaway-tasks/:id/confirmations", (config) =>
    withIdempotency(config, async () => {
      if (!(await currentActor()).can(P.update)) return forbidden();
      const body = parseJsonBody(config.data);
      const lpn = readString(body.lpn);
      const locationCode = readString(body.locationCode);
      const fieldErrors = validate(lpn, locationCode);
      if (fieldErrors.length > 0) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", fieldErrors);
      }
      const task = await findPutawayTask(readRouteId(config));
      if (!task) return beError(404, "PUTAWAY_TASK_NOT_FOUND", "No putaway task");
      if (task.status === "DONE") return beError(409, "PUTAWAY_TASK_DONE", "Already put away");
      if (task.status !== "PENDING") {
        return beError(400, "VALIDATION_FAILED", "The task cannot be put away");
      }
      if (upper(lpn) !== upper(task.lpn)) {
        return beError(409, "PUTAWAY_LPN_MISMATCH", "Scan the carton of the task");
      }
      const carton = await cartonOf(task);
      const from = carton?.pkg.locationCode ?? "";
      const target = await checkTarget(task, from, locationCode);
      if (!("locationCode" in target)) return target;
      if (carton) carton.pkg.locationCode = target.locationCode;
      getWarehouseStore().stockedLocations.add(target.locationCode);
      task.status = "DONE";
      task.targetLocationCode = target.locationCode;
      // BE: cất từ màn một thùng cũng gỡ thùng khỏi xe của chuyến đang chở nó (nhả chỗ giữ)
      const carrying = tripCarrying(task.id);
      if (carrying) {
        carrying.cartons = carrying.cartons.filter((c) => c.putawayTaskId !== task.id);
        carrying.stops = carrying.stops
          .map((s) => ({ ...s, lpns: s.lpns.filter((l) => upper(l) !== upper(task.lpn)) }))
          .filter((s) => s.lpns.length > 0);
      }
      await closeReceiptIfDone(task.goodsReceiptId);
      return beOk(await toResponse(task, false));
    }),
  );
}

export function registerPutawayMockRoutes(): void {
  registerList();
  registerDetail();
  registerConfirm();
}
