/**
 * Mock routes — dòng lấy hàng (SCRUM-267, báo thiếu / phân bổ lại BE PR #147), khớp BE
 * `FulfillmentController#pickLines / #confirmPick / #reportShort / #reallocateShort` + `PickList`.
 * Quyền theo mã như `@RequiresPermission` (BE PR #148), không theo vai trò. Chỉ dùng khi USE_MOCK=true.
 */

import {
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  PICK_LINE_LIMITS,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  canSee,
  currentActor,
  forbidden,
  getFulfillmentStore,
  orderClosedError,
  outOfScope,
  outOfWarehouseScope,
  routeParam,
  taskNotFound,
} from "./mock-routes-fulfillment-store";
import { putMockOrderOnInventoryHold, resolveMockInventoryHold } from "./mock-routes-orders";
import {
  getMockPickLines,
  markPicked,
  reallocateMockShort,
  reportMockShort,
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

import type { AxiosRequestConfig } from "axios";
import type { MockResponse } from "./mock-adapter";
import type { MockActor, MockTask } from "./mock-routes-fulfillment-store";
import type { MockPickLine } from "./mock-routes-pick-lines-store";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

const PATH = "/fulfillment/tasks/:id/pick-lines";

/** Mã vị trí / SKU lưu chữ hoa; máy quét hay bàn phím gửi kiểu nào cũng được (BE `sameCode`). */
const sameCode = (scanned: string, expected: string) =>
  scanned.trim().toUpperCase() === expected.toUpperCase();

/** SKU (mọi kiểu chữ) hoặc barcode chính xác (BE `itemMatches`). */
const itemMatches = (line: MockPickLine, code: string) =>
  code.trim() !== "" &&
  (sameCode(code, line.sku) || (!!line.barcode && code.trim() === line.barcode));

const conflict = (code: string, message: string) => beError(409, code, message);
const notPicking = (task: MockTask, what: string) =>
  conflict(
    "PICK_TASK_STATE_CONFLICT",
    `${what} while the task is PICKING; it is ${task.pickStatus}`,
  );

/** @NotBlank @Size(64) cho mã vị trí / mã hàng. */
function codeErrors(body: Record<string, unknown>, fields: readonly string[]): MockFieldError[] {
  const errors: MockFieldError[] = [];
  for (const field of fields) {
    const value = readString(body[field]).trim();
    if (!value) errors.push({ field, message: "must not be blank", code: "NotBlank" });
    else if (value.length > PICK_LINE_LIMITS.codeMax)
      errors.push({ field, message: "size must be at most 64", code: "Size" });
  }
  return errors;
}

const isInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

/** BE `ConfirmPickRequest`: mã @NotBlank @Size(64), quantity @NotNull @Positive. */
function confirmErrors(body: Record<string, unknown>): MockFieldError[] {
  const errors = codeErrors(body, ["locationCode", "scannedCode"]);
  if (!isInt(body.quantity) || body.quantity <= 0) {
    errors.push({ field: "quantity", message: "must be greater than 0", code: "Positive" });
  }
  return errors;
}

/** BE `ShortPickRequest`: locationCode @NotBlank @Size(64), foundQuantity @NotNull @PositiveOrZero. */
function shortErrors(body: Record<string, unknown>): MockFieldError[] {
  const errors = codeErrors(body, ["locationCode"]);
  if (!isInt(body.foundQuantity) || body.foundQuantity < 0) {
    errors.push({
      field: "foundQuantity",
      message: "must be greater than or equal to 0",
      code: "PositiveOrZero",
    });
  }
  return errors;
}

type AssigneeLine =
  | { ok: false; error: MockResponse }
  | { ok: true; task: MockTask; line: MockPickLine; body: Record<string, unknown> };

/**
 * Khung chung của thao tác người lấy hàng (xác nhận / báo thiếu): quyền picking:UPDATE → body hợp lệ →
 * task → người được gán (khác → 404) → đơn còn ở khâu kho → dòng của task.
 */
async function assigneeLine(
  config: AxiosRequestConfig,
  validate: (body: Record<string, unknown>) => MockFieldError[],
): Promise<AssigneeLine> {
  const actor = await currentActor();
  if (!actor.can(PICKING.update)) return { ok: false, error: forbidden() };
  const body = parseJsonBody(config.data);
  const invalid = validate(body);
  if (invalid.length) {
    return { ok: false, error: beError(400, "VALIDATION_FAILED", "Invalid request data", invalid) };
  }
  const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
  if (!task) return { ok: false, error: taskNotFound() };
  if (task.assignedUserId !== actor.userId) {
    return {
      ok: false,
      error: beError(404, "NOT_FOUND", "Fulfillment task is not assigned to this user"),
    };
  }
  const closed = await orderClosedError(task.orderId);
  if (closed) return { ok: false, error: closed };
  const line = (await getMockPickLines(task)).find(
    (candidate) => candidate.lineId === routeParam(config, "lineId"),
  );
  if (!line)
    return { ok: false, error: beError(404, "NOT_FOUND", "The task has no such pick line") };
  return { ok: true, task, line, body };
}

function registerReadRoute(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const actor: MockActor = await currentActor();
    if (!actor.can(PICK.read)) return forbidden();
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
    // BE `TaskAccess.requireVisible` — người không xem được task nhận 404
    if (!task || !canSee(task, actor)) return taskNotFound();
    const lines = await getMockPickLines(task);
    return beOk(bePage(lines.map(toPickLineResponse), page, size));
  });
}

function registerConfirmRoute(): void {
  registerMockRoute("POST", `${PATH}/:lineId/confirmation`, (config) =>
    withIdempotency(config, async () => {
      const found = await assigneeLine(config, confirmErrors);
      if (!found.ok) return found.error;
      const { task, line, body } = found;
      const location = readString(body.locationCode);
      const code = readString(body.scannedCode);
      const quantity = Number(body.quantity);
      // BE `PickList.confirm` — đúng thứ tự kiểm tra
      if (
        line.status === "PICKED" &&
        sameCode(location, line.locationCode) &&
        itemMatches(line, code) &&
        quantity === line.pickedQty
      ) {
        return beOk(toPickLineResponse(line));
      }
      if (task.pickStatus !== "PICKING") return notPicking(task, "Lines are confirmed");
      if (line.status !== "OPEN")
        return conflict("PICK_LINE_NOT_OPEN", `The line is ${line.status}`);
      if (!sameCode(location, line.locationCode)) {
        return conflict("PICK_LOCATION_MISMATCH", `This line is picked from ${line.locationCode}`);
      }
      if (!itemMatches(line, code))
        return conflict("PICK_ITEM_MISMATCH", `This line picks ${line.sku}`);
      if (quantity > line.allocatedQty) {
        return conflict(
          "PICK_QUANTITY_EXCEEDS_ALLOCATION",
          `${line.allocatedQty} allocated to this line`,
        );
      }
      if (quantity < line.allocatedQty) {
        return conflict("PICK_QUANTITY_SHORT", `${line.allocatedQty} allocated to this line`);
      }
      markPicked(line, new Date().toISOString());
      return beOk(toPickLineResponse(line));
    }),
  );
}

function registerShortRoute(): void {
  registerMockRoute("POST", `${PATH}/:lineId/short`, (config) =>
    withIdempotency(config, async () => {
      const found = await assigneeLine(config, shortErrors);
      if (!found.ok) return found.error;
      const { task, line, body } = found;
      const location = readString(body.locationCode);
      const foundQty = Number(body.foundQuantity);
      // BE `PickList.reportShort` — báo lại y hệt → 200 nguyên trạng
      if (
        line.status === "SHORT" &&
        line.shortQty === line.allocatedQty - foundQty &&
        sameCode(location, line.locationCode)
      ) {
        return beOk(toPickLineResponse(line));
      }
      if (task.pickStatus !== "PICKING") return notPicking(task, "Short picks are reported");
      if (line.status !== "OPEN")
        return conflict("PICK_LINE_NOT_OPEN", `The line is ${line.status}`);
      if (!sameCode(location, line.locationCode)) {
        return conflict("PICK_LOCATION_MISMATCH", `This line is picked from ${line.locationCode}`);
      }
      if (foundQty >= line.allocatedQty) {
        return beError(
          400,
          "VALIDATION_FAILED",
          `${line.allocatedQty} allocated to this line; a short pick finds 0 to ${line.allocatedQty - 1}`,
        );
      }
      reportMockShort(line, foundQty);
      // X-SHORT bước 02: đơn dừng (ON_HOLD, lý do INVENTORY), không huỷ, không trừ tồn
      await putMockOrderOnInventoryHold(task.orderId);
      return beOk(toPickLineResponse(line));
    }),
  );
}

function registerReallocationRoute(): void {
  registerMockRoute("POST", `${PATH}/:lineId/reallocation`, (config) =>
    withIdempotency(config, async () => {
      const actor = await currentActor();
      // Quyết định của người phân việc (điều phối / quản lý kho), không phải người lấy hàng
      if (!actor.can(ASSIGNMENT.update)) return forbidden();
      const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
      if (!task) return taskNotFound();
      // BE `WarehouseScope.requireWarehouse(pick.getWarehouseId())` trước mọi kiểm tra khác của dòng
      if (await outOfWarehouseScope(actor.userId, task.warehouseId)) return outOfScope();
      const closed = await orderClosedError(task.orderId);
      if (closed) return closed;
      const lines = await getMockPickLines(task);
      const line = lines.find((candidate) => candidate.lineId === routeParam(config, "lineId"));
      if (!line) return beError(404, "NOT_FOUND", "The task has no such pick line");
      if (line.status !== "SHORT") {
        return conflict(
          "PICK_LINE_NOT_OPEN",
          `Only a SHORT line with an allocation is reallocated; it is ${line.status}`,
        );
      }
      const added = await reallocateMockShort(task, line);
      if (!added) return conflict("INSUFFICIENT_STOCK", "Not enough available stock");
      if (!lines.some((candidate) => candidate.status === "SHORT")) {
        resolveMockInventoryHold(task.orderId);
      }
      return beOk(added.map(toPickLineResponse));
    }),
  );
}

export function registerPickLineMockRoutes(): void {
  registerReadRoute();
  registerConfirmRoute();
  registerShortRoute();
  registerReallocationRoute();
}
