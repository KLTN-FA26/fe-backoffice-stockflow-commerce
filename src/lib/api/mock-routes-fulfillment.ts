/**
 * Mock routes — Fulfillment task (docs 07/08), khớp BE `FulfillmentController` +
 * `FulfillmentServiceImpl` (SCRUM-43). Chỉ dùng khi USE_MOCK=true.
 *
 * Giữ đúng hành vi BE: phạm vi danh sách theo mã quyền, 404 (không phải 403) khi không phải người
 * được gán, tạo task kèm đích DISPATCH / STAGING (kèm khu chờ xuất), chuyển cả task `Staged` sang khu xuất hàng
 * (`dispatch-transfer`), lỗi dùng mã chung NOT_FOUND / CONFLICT / VALIDATION_FAILED kèm message tiếng Anh — FE tự
 * dịch theo ngữ cảnh.
 */

import {
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS as OVERSIGHT,
  PICK_API_STATUSES,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { toBackendRoles } from "./mock-backend-roles";
import {
  canSee,
  conflict,
  currentActor,
  findMockOrder,
  forbidden,
  getFulfillmentStore,
  nextTaskId,
  orderClosedError,
  outOfScope,
  outOfWarehouseScope,
  routeParam,
  taskNotFound,
  taskLinesOf,
  toTaskResponse,
} from "./mock-routes-fulfillment-store";
import { registerCartonCheckMockRoutes } from "./mock-routes-carton-check";
import { registerPickLineMockRoutes } from "./mock-routes-pick-lines";
import { registerPutBackMockRoutes } from "./mock-routes-put-backs";
import { getMockPickLines } from "./mock-routes-pick-lines-store";
import {
  isMockLocationUsable,
  mockLocationCode,
  mockWarehouseLocations,
} from "./mock-routes-warehouse-layout";
import { backendOrderStatusOf, setMockOrderStatus } from "./mock-routes-orders-store";
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
import type { MockTask } from "./mock-routes-fulfillment-store";

const PATH = "/fulfillment/tasks";
const newestFirst = (a: MockTask, b: MockTask) => b.createdAt.localeCompare(a.createdAt);

/**
 * BE `requireWarehouseAssignee`: ACTIVE + WAREHOUSE_STAFF hoặc WAREHOUSE_MANAGER. Đây là điều kiện của
 * NGƯỜI ĐƯỢC GÁN (ai nhận việc), không phải quyền của người gọi — nên vẫn đọc vai trò.
 */
function isWarehouseAssignee(user: { active: boolean; roles: readonly string[] }): boolean {
  return (
    user.active &&
    user.roles.some((role) => role === "Warehouse Staff" || role === "Warehouse Manager")
  );
}

async function isValidAssignee(userId: string): Promise<boolean> {
  const { staffUsers } = await import("@/lib/mock-data");
  const user = staffUsers.find((candidate) => candidate.userId === userId);
  return !!user && isWarehouseAssignee(user);
}

const isDestination = (value: string): value is MockTask["destination"] =>
  value === "DISPATCH" || value === "STAGING";

/**
 * BE `stagingAreaFor` (docs 07 §3): không có khu cho task DISPATCH (dù form còn mang lựa chọn cũ); task STAGING lấy khu
 * được nêu — phải là khu chờ xuất đang hoạt động của kho — hoặc khu duy nhất của kho; còn lại 422 STAGING_AREA_INVALID.
 */
async function stagingAreaFor(
  warehouseId: string,
  destination: MockTask["destination"],
  requested: string,
): Promise<{ code?: string } | { error: ReturnType<typeof beError> }> {
  if (destination !== "STAGING") return {};
  const areas = (await mockWarehouseLocations(warehouseId))
    .filter((location) => location.type === "staging" && isMockLocationUsable(location))
    .map(mockLocationCode);
  const wanted = requested.trim().toUpperCase();
  const invalid = (message: string) => ({
    error: beError(422, "STAGING_AREA_INVALID", message, [
      { field: "stagingLocationCode", message },
    ]),
  });
  if (wanted) {
    const match = areas.find((code) => code.toUpperCase() === wanted);
    return match
      ? { code: match }
      : invalid("must be an active staging area of the task's warehouse");
  }
  if (areas.length === 1) return { code: areas[0] };
  return invalid(
    areas.length === 0
      ? "the warehouse has no active staging area"
      : `name one of ${areas.join(", ")}`,
  );
}

const invalidAssignee = () =>
  beError(
    400,
    "VALIDATION_FAILED",
    "Assignee must be an active warehouse staff member or warehouse manager",
  );

const missingField = (field: string) =>
  beError(400, "VALIDATION_FAILED", "Invalid request data", [
    { field, message: "must not be null" },
  ]);

async function loadTask(config: AxiosRequestConfig) {
  const store = await getFulfillmentStore();
  return { store, task: store.get(routeParam(config, "id")), actor: await currentActor() };
}

/** Khung chung của start / complete picking: quyền → người được gán → đơn còn mở → chuyển. */
function registerPickStep(
  suffix: string,
  from: MockTask["pickStatus"],
  apply: (task: MockTask, now: string) => void,
) {
  registerMockRoute("POST", `${PATH}/:id/${suffix}`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!actor.can(PICKING.update)) return forbidden();
    if (!task) return taskNotFound();
    if (task.assignedUserId !== actor.userId) {
      return beError(404, "NOT_FOUND", "Fulfillment task is not assigned to this user");
    }
    const closed = await orderClosedError(task.orderId);
    if (closed) return closed;
    if (task.pickStatus !== from) return conflict();
    // BE `planLines` (lúc tạo task / lười ở picking-start) + `requireAllPicked` lúc hoàn tất (docs 07 §4.2 bước 6): mọi
    // dòng PICKED — hoặc STAGED, với task đích STAGING — hoặc CANCELLED (dòng thiếu đã phân bổ lại); còn OPEN / SHORT → 409
    const lines = await getMockPickLines(task);
    const open = lines.filter(
      (line) => line.status !== "PICKED" && line.status !== "STAGED" && line.status !== "CANCELLED",
    );
    if (suffix === "picking-completion" && open.length > 0) {
      return beError(
        409,
        "PICK_LINES_INCOMPLETE",
        `${open.length} of ${lines.length} lines are not picked yet`,
      );
    }
    apply(task, new Date().toISOString());
    return beOk(toTaskResponse(task));
  });
}

function registerTaskReadRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    // BE `parseStatus`: PickStatus (any case), unknown value → 400 UNSUPPORTED_PARAMETER.
    const status = readString(([] as unknown[]).concat(params.status ?? [])[0]).toUpperCase();
    if (status && !PICK_API_STATUSES.some((known) => known === status)) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unknown pick status");
    }
    const actor = await currentActor();
    // BE `listTasks`: endpoint cần pick-lists:READ; phạm vi theo quyền — task-oversight:READ thấy hết, còn lại
    // thấy task của mình
    if (!actor.can(PICK.read)) return forbidden();
    // SCRUM-466: lọc kho / người được gán chỉ thu hẹp trong phạm vi; kho ngoài phạm vi → 403 trước
    const warehouseId = readString(params.warehouseId);
    const assignedUserId = readString(params.assignedUserId);
    if (warehouseId && (await outOfWarehouseScope(actor.userId, warehouseId))) return outOfScope();
    const all = [...(await getFulfillmentStore()).values()]
      .filter((task) => !status || task.pickStatus === status)
      .filter((task) => !warehouseId || task.warehouseId === warehouseId)
      .filter((task) => !assignedUserId || task.assignedUserId === assignedUserId)
      .sort(newestFirst);
    let visible: MockTask[];
    if (actor.can(OVERSIGHT.read)) visible = all;
    else visible = all.filter((t) => t.assignedUserId === actor.userId);
    return beOk(bePage(visible.map(toTaskResponse), page, size));
  });

  registerMockRoute("GET", `${PATH}/:id`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!task || !canSee(task, actor)) return taskNotFound();
    // Chỉ chi tiết kèm `lines` (BE `FulfillmentServiceImpl#getTask`, SCRUM-466)
    return beOk({ ...toTaskResponse(task), lines: await taskLinesOf(task) });
  });
}

function registerAssignmentRoutes(): void {
  registerMockRoute("POST", PATH, async (config) => {
    const actor = await currentActor();
    if (!actor.can(ASSIGNMENT.create)) return forbidden();
    const body = parseJsonBody(config.data);
    const orderId = readString(body.orderId);
    const assignedUserId = readString(body.assignedUserId);
    if (!orderId) return missingField("orderId");
    if (!assignedUserId) return missingField("assignedUserId");
    if (!(await isValidAssignee(assignedUserId))) return invalidAssignee();
    // `destination` mặc định DISPATCH; giá trị lạ → 400 (BE: enum không đọc được)
    const requested = body.destination === undefined ? "DISPATCH" : readString(body.destination);
    if (!isDestination(requested)) {
      return beError(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "destination", message: "must be DISPATCH or STAGING" },
      ]);
    }
    const store = await getFulfillmentStore();
    // Một đơn một task: đã có → trả task cũ nguyên trạng (BE `findByOrderId`)
    const existing = [...store.values()].find((t) => t.orderId === orderId);
    if (existing) {
      return canSee(existing, actor) ? beOk(toTaskResponse(existing), 201) : taskNotFound();
    }
    const order = await findMockOrder(orderId);
    if (!order) return taskNotFound();
    // BE PR #133: chỉ đơn READY_TO_FULFILL (đã release) mới vào xuất kho — đơn CONFIRMED phải release trước
    const orderStatus = await backendOrderStatusOf(orderId);
    if (orderStatus !== "READY_TO_FULFILL") {
      // BE `FulfillmentServiceImpl#createTask`: PICK_TASK_STATE_CONFLICT (409), không phải CONFLICT chung
      return beError(
        409,
        "PICK_TASK_STATE_CONFLICT",
        `Only a released order (READY_TO_FULFILL) can enter fulfillment; it is ${orderStatus ?? "UNKNOWN"}`,
      );
    }
    // BE `stagingAreaFor` — trước khi ghi gì: task STAGING không có chỗ để tập kết thì bị từ chối nguyên
    const area = await stagingAreaFor(
      order.fulfillmentWarehouseId,
      requested,
      readString(body.stagingLocationCode),
    );
    if ("error" in area) return area.error;
    const now = new Date().toISOString();
    const task: MockTask = {
      taskId: nextTaskId(),
      orderId,
      orderNumber: order.orderNumber,
      warehouseId: order.fulfillmentWarehouseId,
      assignedUserId,
      pickStatus: "PENDING",
      packStatus: "PENDING",
      destination: requested,
      ...(area.code ? { stagingLocationCode: area.code } : {}),
      assignedAt: now,
      createdAt: now,
    };
    store.set(task.taskId, task);
    // BE `createTask` lập luôn dòng lấy hàng (mọi dòng OPEN)
    await getMockPickLines(task);
    // READY_TO_FULFILL → PICKING, cùng giao dịch với việc tạo task (BE `orders.startPicking`)
    setMockOrderStatus(orderId, "PICKING");
    return beOk(toTaskResponse(task), 201);
  });

  registerMockRoute("PUT", `${PATH}/:id/assignment`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!actor.can(ASSIGNMENT.update)) return forbidden();
    const assignedUserId = readString(parseJsonBody(config.data).assignedUserId);
    if (!assignedUserId) return missingField("assignedUserId");
    if (!(await isValidAssignee(assignedUserId))) return invalidAssignee();
    if (!task) return taskNotFound();
    if (task.pickStatus !== "PENDING") return conflict("A pick can only be assigned while pending");
    task.assignedUserId = assignedUserId;
    task.assignedAt = new Date().toISOString();
    return beOk(toTaskResponse(task));
  });
}

/**
 * `POST /tasks/{id}/dispatch-transfer` (BE `FulfillmentServiceImpl#moveToDispatch`, docs 07 §4.3 bước 8, BR-11): quyết
 * định của người phân việc (`fulfillment-task-assignment:UPDATE`). Gọi lại cho task đã chuyển → 200 nguyên trạng; task
 * không `Staged` → 409 PICK_TASK_STATE_CONFLICT; đơn đang treo → 409 PICK_ORDER_ON_HOLD (thùng ở lại khu chờ xuất).
 * Chuyển: mọi dòng Staged → Picked (trừ tồn), task → Picked.
 */
function registerDispatchTransferRoute(): void {
  registerMockRoute("POST", `${PATH}/:id/dispatch-transfer`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!actor.can(ASSIGNMENT.update)) return forbidden();
    if (!task) return taskNotFound();
    if (await outOfWarehouseScope(actor.userId, task.warehouseId)) return outOfScope();
    if (task.pickStatus === "PICKED" && task.movedToDispatchAt) return beOk(toTaskResponse(task));
    if (task.pickStatus !== "STAGED") {
      return beError(
        409,
        "PICK_TASK_STATE_CONFLICT",
        `A task moves to dispatch from STAGED; it is ${task.pickStatus}`,
      );
    }
    const closed = await orderClosedError(task.orderId);
    if (closed) return closed;
    if ((await backendOrderStatusOf(task.orderId)) === "ON_HOLD") {
      return beError(
        409,
        "PICK_ORDER_ON_HOLD",
        `Order ${task.orderNumber} is on hold; task ${task.taskId} stays staged`,
      );
    }
    const now = new Date().toISOString();
    for (const line of await getMockPickLines(task)) {
      if (line.status === "STAGED") line.status = "PICKED";
    }
    task.pickStatus = "PICKED";
    task.pickedAt = now;
    task.movedToDispatchAt = now;
    return beOk(toTaskResponse(task));
  });
}

/**
 * `GET /fulfillment/assignees?warehouseId=` (BE `FulfillmentServiceImpl#assignees`, guard
 * `fulfillment-task-assignment:UPDATE`): nhân viên kho / quản lý kho đang hoạt động được gán cho kho đó.
 * Kho bắt buộc (400); kho lạ → 404 WAREHOUSE_NOT_FOUND; người gọi chỉ hỏi được kho trong phạm vi của mình.
 */
function registerAssigneeRoutes(): void {
  registerMockRoute("GET", "/fulfillment/assignees", async (config) => {
    const actor = await currentActor();
    if (!actor.can(ASSIGNMENT.update)) return forbidden();
    const warehouseId = readString(readParams(config).warehouseId);
    if (!warehouseId) return missingField("warehouseId");
    const { staffUsers, warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((warehouse) => warehouse.warehouseId === warehouseId)) {
      return beError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
    }
    if (await outOfWarehouseScope(actor.userId, warehouseId)) return outOfScope();
    const assignees = staffUsers
      .filter(
        (user) =>
          isWarehouseAssignee(user) &&
          ((user.warehouseIds as readonly string[]).length === 0 ||
            (user.warehouseIds as readonly string[]).includes(warehouseId)),
      )
      .map((user) => ({
        userId: user.userId,
        displayName: user.fullName,
        roles: toBackendRoles(user.roles),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
    return beOk(assignees);
  });
}

/**
 * `GET /fulfillment/task-candidates` (BE PR #151, `FulfillmentServiceImpl#taskCandidates`, guard
 * `fulfillment-task-assignment:CREATE`): đơn READY_TO_FULFILL chưa có task, release cũ nhất trước.
 * `warehouseId` tuỳ chọn: bỏ qua → mọi kho trong phạm vi của người gọi; kho ngoài phạm vi → 403
 * OUT_OF_DATA_SCOPE (kiểm trước); người gọi không bị giới hạn kho gửi kho lạ → 404 WAREHOUSE_NOT_FOUND;
 * `size` > 200 → 400.
 */
function registerTaskCandidateRoutes(): void {
  registerMockRoute("GET", "/fulfillment/task-candidates", async (config) => {
    const actor = await currentActor();
    if (!actor.can(ASSIGNMENT.create)) return forbidden();
    const params = readParams(config);
    const page = Math.max(0, readInt(params.page, 0));
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(
        400,
        "UNSUPPORTED_PARAMETER",
        `size must be between 1 and ${BE_MAX_PAGE_SIZE}`,
      );
    }
    const { customers, orders, staffUsers, warehouses } = await import("@/lib/mock-data");
    const warehouseId = readString(params.warehouseId);
    const caller = staffUsers.find((user) => user.userId === actor.userId);
    const callerScope: readonly string[] = caller?.warehouseIds ?? [];
    // Như BE `TaskCandidateService`: kiểm phạm vi trước, rồi mới tới kho có tồn tại không — người ngoài
    // phạm vi không được biết kho khác có thật hay không
    if (warehouseId && callerScope.length > 0 && !callerScope.includes(warehouseId)) {
      return beError(403, "OUT_OF_DATA_SCOPE", "The warehouse is outside your data scope");
    }
    if (warehouseId && !warehouses.some((warehouse) => warehouse.warehouseId === warehouseId)) {
      return beError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
    }
    // Chạy sau khi store khởi tạo: seed đặt trạng thái BE của đơn theo task đã có
    const store = await getFulfillmentStore();
    const withTask = new Set([...store.values()].map((task) => task.orderId));
    const candidates = [];
    for (const order of orders) {
      if (withTask.has(order.orderId)) continue;
      if ((await backendOrderStatusOf(order.orderId)) !== "READY_TO_FULFILL") continue;
      if (
        warehouseId
          ? order.fulfillmentWarehouseId !== warehouseId
          : callerScope.length > 0 && !callerScope.includes(order.fulfillmentWarehouseId)
      ) {
        continue;
      }
      candidates.push({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: customers.find((c) => c.customerId === order.customerId)?.fullName,
        warehouseId: order.fulfillmentWarehouseId,
        placedAt: order.placedAt,
        releasedAt: order.confirmedAt ?? order.placedAt,
        lineCount: order.lines.length,
        totalQuantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
        lines: order.lines.map((line) => ({
          orderLineId: line.lineId,
          sku: line.skuId,
          quantity: line.quantity,
          printed: Boolean(line.designId),
        })),
      });
    }
    candidates.sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
    return beOk(bePage(candidates, page, size));
  });
}

export function registerFulfillmentMockRoutes(): void {
  registerTaskReadRoutes();
  registerAssignmentRoutes();
  registerPickStep("picking-start", "PENDING", (task, now) => {
    task.pickStatus = "PICKING";
    task.startedAt = now;
  });
  registerPickStep("picking-completion", "PICKING", (task, now) => {
    // Đích STAGING → Staged (thùng gom ở khu chờ xuất, chờ chuyển); đích DISPATCH → Picked (docs 07 §4.2 bước 6)
    if (task.destination === "STAGING" && !task.movedToDispatchAt) {
      task.pickStatus = "STAGED";
      task.stagedAt = now;
    } else {
      task.pickStatus = "PICKED";
      task.pickedAt = now;
    }
  });
  registerDispatchTransferRoute();
  registerCartonCheckMockRoutes();
  registerAssigneeRoutes();
  registerTaskCandidateRoutes();
  registerPickLineMockRoutes();
  registerPutBackMockRoutes();
}
