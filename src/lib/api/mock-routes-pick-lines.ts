/**
 * Mock routes — dòng lấy hàng (docs 07 §4.2, §4.4: quét vị trí + LPN, báo thiếu kèm lý do, phân bổ lại thùng), khớp BE
 * `FulfillmentController#pickLines / #confirmPick / #reportShort / #reallocateShort` + `PickList`.
 * Quyền theo mã như `@RequiresPermission` (BE PR #148), không theo vai trò. Chỉ dùng khi USE_MOCK=true.
 */

import {
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  PICK_LINE_LIMITS,
  SHORT_PICK_REASONS,
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
import type { MockPickLine, MockShortReason } from "./mock-routes-pick-lines-store";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

const PATH = "/fulfillment/tasks/:id/pick-lines";

/** Mã vị trí / SKU lưu chữ hoa; máy quét hay bàn phím gửi kiểu nào cũng được (BE `sameCode`). */
const sameCode = (scanned: string, expected: string) =>
  scanned.trim().toUpperCase() === expected.toUpperCase();

/** LPN chỉ khớp đúng LPN của dòng, không phân biệt hoa thường (docs 07 BR-10: SKU / mã vạch / thùng khác đều bị từ chối). */
const lpnMatches = (line: MockPickLine, scanned: string) => sameCode(scanned, line.lpn);

const conflict = (code: string, message: string) => beError(409, code, message);
const notPicking = (task: MockTask, what: string) =>
  conflict(
    "PICK_TASK_STATE_CONFLICT",
    `${what} while the task is PICKING; it is ${task.pickStatus}`,
  );

/** @NotBlank @Size(max) cho mã vị trí (64) / LPN (30). */
function codeErrors(
  body: Record<string, unknown>,
  fields: readonly { field: string; max: number }[],
): MockFieldError[] {
  const errors: MockFieldError[] = [];
  for (const { field, max } of fields) {
    const value = readString(body[field]).trim();
    if (!value) errors.push({ field, message: "must not be blank", code: "NotBlank" });
    else if (value.length > max)
      errors.push({ field, message: `size must be at most ${max}`, code: "Size" });
  }
  return errors;
}

const LOCATION_FIELD = { field: "locationCode", max: PICK_LINE_LIMITS.codeMax } as const;
const LPN_FIELD = { field: "lpn", max: PICK_LINE_LIMITS.lpnMax } as const;

/** BE `ConfirmPickRequest`: locationCode @NotBlank @Size(64), lpn @NotBlank @Size(30); không có số lượng. */
const confirmErrors = (body: Record<string, unknown>) =>
  codeErrors(body, [LOCATION_FIELD, LPN_FIELD]);

/** BE `ShortPickRequest`: locationCode @NotBlank @Size(64), reason @NotNull (NOT_FOUND | DAMAGED). */
function shortErrors(body: Record<string, unknown>): MockFieldError[] {
  const errors = codeErrors(body, [LOCATION_FIELD]);
  if (!(SHORT_PICK_REASONS as readonly unknown[]).includes(body.reason)) {
    errors.push({ field: "reason", message: "must not be null", code: "NotNull" });
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
      const lpn = readString(body.lpn);
      // BE `PickList.confirm` — đúng thứ tự kiểm tra; quét lại đúng cùng một thùng → 200 nguyên trạng
      if (
        (line.status === "PICKED" || line.status === "STAGED") &&
        sameCode(location, line.locationCode) &&
        lpnMatches(line, lpn)
      ) {
        return beOk(toPickLineResponse(line));
      }
      if (task.pickStatus !== "PICKING") return notPicking(task, "Lines are confirmed");
      if (line.status !== "OPEN")
        return conflict("PICK_LINE_NOT_OPEN", `The line is ${line.status}`);
      if (!sameCode(location, line.locationCode)) {
        return conflict("PICK_LOCATION_MISMATCH", `This line is picked from ${line.locationCode}`);
      }
      if (!lpnMatches(line, lpn))
        return conflict("PICK_ITEM_MISMATCH", `This line picks carton ${line.lpn}`);
      // Đích STAGING (chưa chuyển sang khu xuất hàng): thùng về khu chờ xuất, chưa trừ tồn (STAGED)
      const staging =
        task.destination === "STAGING" && !task.movedToDispatchAt
          ? task.stagingLocationCode
          : undefined;
      markPicked(line, new Date().toISOString(), staging);
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
      const reason = readString(body.reason) as MockShortReason;
      // BE `PickList.reportShort` — báo lại y hệt → 200 nguyên trạng
      if (
        line.status === "SHORT" &&
        line.shortReason === reason &&
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
      reportMockShort(line, reason);
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
