/**
 * Mock routes — Fulfillment task (docs 07/08), khớp BE `FulfillmentController` +
 * `FulfillmentServiceImpl` (SCRUM-43). Chỉ dùng khi USE_MOCK=true.
 *
 * Giữ đúng hành vi BE: phạm vi danh sách theo vai trò, 404 (không phải 403) khi không phải người
 * được gán, lệch checksum trả 200 với pack ON_HOLD, lỗi chỉ dùng mã chung NOT_FOUND / CONFLICT /
 * VALIDATION_FAILED kèm message tiếng Anh — FE tự dịch theo ngữ cảnh.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  conflict,
  currentActor,
  findMockOrder,
  forbidden,
  getFulfillmentStore,
  hasAnyRole,
  isTampered,
  nextTaskId,
  orderClosedError,
  routeParam,
  taskNotFound,
  toTaskResponse,
  verifyDesigns,
} from "./mock-routes-fulfillment-store";
import { BACKEND_ROLE_BY_MOCK_ROLE } from "./mock-routes-me";
import { backendOrderStatusOf, lockedChecksumOf, setMockOrderStatus } from "./mock-routes-orders";
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
import type { MockActor, MockTask } from "./mock-routes-fulfillment-store";

const PATH = "/fulfillment/tasks";
const ARTIFACT_ROLES = [
  "CUSTOMER_PREVIEW",
  "TECHNICAL_SPEC",
  "PRINT_READY",
  "PRODUCTION_INSTRUCTION",
];
/** ASSUMPTION (mock-only): bundle mock không có file hướng dẫn sản xuất → demo nhánh 404. */
const MISSING_ARTIFACT_ROLE = "PRODUCTION_INSTRUCTION";
const ARTIFACT_TTL_MS = 5 * 60_000;

const newestFirst = (a: MockTask, b: MockTask) => b.createdAt.localeCompare(a.createdAt);

/** BE `requireWarehouseAssignee`: ACTIVE + WAREHOUSE_STAFF hoặc WAREHOUSE_MANAGER. */
async function isValidAssignee(userId: string): Promise<boolean> {
  const { staffUsers } = await import("@/lib/mock-data");
  const user = staffUsers.find((candidate) => candidate.userId === userId);
  return (
    !!user?.active &&
    user.roles.some((role) => role === "Warehouse Staff" || role === "Warehouse Manager")
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

/** BE `visible`: người được gán, hoặc quản lý kho / QC / điều phối. */
function canSee(task: MockTask, actor: MockActor): boolean {
  return (
    task.assignedUserId === actor.userId ||
    hasAnyRole(actor, "WAREHOUSE_MANAGER", "QC_STAFF", "ORDER_COORDINATOR")
  );
}

async function loadTask(config: AxiosRequestConfig) {
  const store = await getFulfillmentStore();
  return { store, task: store.get(routeParam(config, "id")), actor: await currentActor() };
}

/** Khung chung của start / complete picking: vai trò → người được gán → đơn còn mở → chuyển. */
function registerPickStep(
  suffix: string,
  from: MockTask["pickStatus"],
  apply: (task: MockTask, now: string) => void,
) {
  registerMockRoute("POST", `${PATH}/:id/${suffix}`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!hasAnyRole(actor, "WAREHOUSE_STAFF", "WAREHOUSE_MANAGER")) return forbidden();
    if (!task) return taskNotFound();
    if (task.assignedUserId !== actor.userId) {
      return beError(404, "NOT_FOUND", "Fulfillment task is not assigned to this user");
    }
    const closed = await orderClosedError(task.orderId);
    if (closed) return closed;
    if (task.pickStatus !== from) return conflict();
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
    const actor = await currentActor();
    const all = [...(await getFulfillmentStore()).values()].sort(newestFirst);
    // BE `listTasks`: quản lý / điều phối thấy hết → QC chỉ thấy kiện đang giữ → NV kho thấy của mình
    let visible: MockTask[];
    if (hasAnyRole(actor, "WAREHOUSE_MANAGER", "ORDER_COORDINATOR")) visible = all;
    else if (hasAnyRole(actor, "QC_STAFF")) visible = all.filter((t) => t.packStatus === "ON_HOLD");
    else if (hasAnyRole(actor, "WAREHOUSE_STAFF")) {
      visible = all.filter((t) => t.assignedUserId === actor.userId);
    } else return forbidden();
    return beOk(bePage(visible.map(toTaskResponse), page, size));
  });

  registerMockRoute("GET", `${PATH}/:id`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!task || !canSee(task, actor)) return taskNotFound();
    return beOk(toTaskResponse(task));
  });

  registerMockRoute(
    "GET",
    `${PATH}/:id/lines/:lineId/design-artifacts/:role/download-url`,
    async (config) => {
      const { task, actor } = await loadTask(config);
      if (!hasAnyRole(actor, "WAREHOUSE_STAFF", "WAREHOUSE_MANAGER", "QC_STAFF"))
        return forbidden();
      if (!task) return taskNotFound();
      // BE `requireArtifactAccess`: người được gán, hoặc quản lý kho / QC (không có điều phối)
      if (
        task.assignedUserId !== actor.userId &&
        !hasAnyRole(actor, "WAREHOUSE_MANAGER", "QC_STAFF")
      ) {
        return taskNotFound();
      }
      const closed = await orderClosedError(task.orderId);
      if (closed) return closed;
      const order = await findMockOrder(task.orderId);
      const line = order?.lines.find((l) => l.lineId === routeParam(config, "lineId"));
      if (!line) return taskNotFound();
      if (!line.designId) return beError(404, "NOT_FOUND", "Order line has no confirmed design");
      const role = routeParam(config, "role").toUpperCase();
      if (!ARTIFACT_ROLES.includes(role)) {
        return beError(400, "UNSUPPORTED_PARAMETER", "Unknown design artifact role");
      }
      if (isTampered(task.orderId)) return conflict("Design integrity verification failed");
      if (role === MISSING_ARTIFACT_ROLE) {
        return beError(404, "NOT_FOUND", `The confirmed bundle has no ${role} artifact`);
      }
      const preview = role === "CUSTOMER_PREVIEW";
      const body = preview
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="white" stroke="black"/><text x="160" y="165" text-anchor="middle" font-family="monospace" font-size="18">${line.designId}</text></svg>`
        : `Mock ${role} of ${line.designId}`;
      const contentType = preview ? "image/svg+xml" : "text/plain";
      return beOk({
        artifactId: `ART-${line.designId}-${role}`,
        role,
        originalName: `${line.designId}-${role.toLowerCase()}.${preview ? "svg" : "txt"}`,
        contentType,
        sizeBytes: body.length,
        checksum: lockedChecksumOf(line),
        url: `data:${contentType};charset=utf-8,${encodeURIComponent(body)}`,
        expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
      });
    },
  );
}

function registerAssignmentRoutes(): void {
  registerMockRoute("POST", PATH, async (config) => {
    const actor = await currentActor();
    if (!hasAnyRole(actor, "ORDER_COORDINATOR", "WAREHOUSE_MANAGER")) return forbidden();
    const body = parseJsonBody(config.data);
    const orderId = readString(body.orderId);
    const assignedUserId = readString(body.assignedUserId);
    if (!orderId) return missingField("orderId");
    if (!assignedUserId) return missingField("assignedUserId");
    if (!(await isValidAssignee(assignedUserId))) return invalidAssignee();
    const store = await getFulfillmentStore();
    // Một đơn một task: đã có → trả task cũ nguyên trạng (BE `findByOrderId`)
    const existing = [...store.values()].find((t) => t.orderId === orderId);
    if (existing) {
      return canSee(existing, actor) ? beOk(toTaskResponse(existing), 201) : taskNotFound();
    }
    const order = await findMockOrder(orderId);
    if (!order) return taskNotFound();
    // Mock đơn hàng còn dùng PAID cho trạng thái BE CONFIRMED (xem STATUS_FILTER_ALIAS)
    if ((await backendOrderStatusOf(orderId)) !== "PAID") {
      return conflict("Only a confirmed or released order can enter fulfillment");
    }
    if (order.lines.some((line) => line.designId)) {
      return conflict(
        `Order ${order.orderNumber} cannot be released from status CONFIRMED; release it to production first: it has lines to print`,
      );
    }
    const now = new Date().toISOString();
    const task: MockTask = {
      taskId: nextTaskId(),
      orderId,
      assignedUserId,
      pickStatus: "PENDING",
      packStatus: "PENDING",
      assignedAt: now,
      createdAt: now,
      evidence: [],
    };
    store.set(task.taskId, task);
    setMockOrderStatus(orderId, "IN_FULFILMENT");
    return beOk(toTaskResponse(task), 201);
  });

  registerMockRoute("PUT", `${PATH}/:id/assignment`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!hasAnyRole(actor, "ORDER_COORDINATOR", "WAREHOUSE_MANAGER")) return forbidden();
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

function registerPackRoutes(): void {
  registerMockRoute("POST", `${PATH}/:id/packing-completion`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!hasAnyRole(actor, "WAREHOUSE_STAFF", "WAREHOUSE_MANAGER")) return forbidden();
    if (!task) return taskNotFound();
    if (task.assignedUserId !== actor.userId) {
      return beError(404, "NOT_FOUND", "Fulfillment task is not assigned to this user");
    }
    if (task.pickStatus !== "PICKED") return conflict("Picking must finish before packing");
    const closed = await orderClosedError(task.orderId);
    if (closed) return closed;
    if (task.packStatus === "ON_HOLD") {
      return conflict("A checksum hold requires QC or warehouse-manager reverification");
    }
    if (task.packStatus !== "PENDING" && task.packStatus !== "PACKING") return conflict();
    const order = await findMockOrder(task.orderId);
    if (!order) return taskNotFound();
    if (verifyDesigns(task, order, false)) {
      task.packStatus = "PACKED";
      task.packedAt = new Date().toISOString();
    } else {
      // X-CHK: lệch → pack + đơn ON_HOLD, vẫn HTTP 200
      task.packStatus = "ON_HOLD";
      setMockOrderStatus(task.orderId, "ON_HOLD");
    }
    return beOk(toTaskResponse(task));
  });

  registerMockRoute("POST", `${PATH}/:id/design-integrity-reverification`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!hasAnyRole(actor, "QC_STAFF", "WAREHOUSE_MANAGER")) return forbidden();
    const note = readString(parseJsonBody(config.data).resolutionNote);
    if (!note) {
      return beError(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "resolutionNote", message: "must not be blank" },
      ]);
    }
    if (!task) return taskNotFound();
    if (task.packStatus !== "ON_HOLD") return conflict("The package has no design-integrity hold");
    const closed = await orderClosedError(task.orderId);
    if (closed) return closed;
    const order = await findMockOrder(task.orderId);
    if (!order) return taskNotFound();
    if (verifyDesigns(task, order, true)) {
      task.packStatus = "PACKED";
      task.packedAt = new Date().toISOString();
      setMockOrderStatus(task.orderId, "IN_FULFILMENT");
    }
    return beOk(toTaskResponse(task));
  });
}

/** `GET /identity/users` (BE UserManagementController) — phần màn gán task dùng: role + status. */
function registerUserRoutes(): void {
  registerMockRoute("GET", "/identity/users", async (config) => {
    const { staffUsers } = await import("@/lib/mock-data");
    const params = readParams(config);
    const role = readString(params.role);
    const status = readString(params.status);
    const users = staffUsers
      .map((user) => ({
        userId: user.userId,
        username: user.email.split("@")[0] ?? user.email,
        email: user.email,
        fullName: user.fullName,
        status: user.active ? "ACTIVE" : "DISABLED",
        roles: user.roles.map((name) => BACKEND_ROLE_BY_MOCK_ROLE[name]).sort(),
        warehouseIds: user.warehouseIds,
      }))
      .filter((user) => (!role || user.roles.includes(role)) && (!status || user.status === status))
      .sort((a, b) => a.username.localeCompare(b.username));
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    return beOk(bePage(users, readInt(params.page, 0), size));
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
    task.pickStatus = "PICKED";
    task.pickedAt = now;
  });
  registerPackRoutes();
  registerUserRoutes();
}
