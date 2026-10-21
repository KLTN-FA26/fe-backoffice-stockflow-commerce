/**
 * Mock routes — Fulfillment task (docs 07/08), khớp BE `FulfillmentController` +
 * `FulfillmentServiceImpl` (SCRUM-43). Chỉ dùng khi USE_MOCK=true.
 *
 * Giữ đúng hành vi BE: phạm vi danh sách theo vai trò, 404 (không phải 403) khi không phải người
 * được gán, lệch checksum trả 200 với pack ON_HOLD, lỗi chỉ dùng mã chung NOT_FOUND / CONFLICT /
 * VALIDATION_FAILED kèm message tiếng Anh — FE tự dịch theo ngữ cảnh.
 */

import {
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS as REVERIFY,
  FULFILLMENT_PACKAGE_PERMISSIONS as PACK,
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS as OVERSIGHT,
  PICK_API_STATUSES,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { toBackendRoles } from "./mock-backend-roles";
import {
  conflict,
  currentActor,
  findMockOrder,
  forbidden,
  getFulfillmentStore,
  isTampered,
  nextTaskId,
  orderClosedError,
  routeParam,
  taskNotFound,
  toTaskResponse,
  verifyDesigns,
} from "./mock-routes-fulfillment-store";
import { registerPackingMockRoutes } from "./mock-routes-packing";
import {
  backendOrderStatusOf,
  lockedChecksumOf,
  resolveMockDesignHold,
  setMockOrderStatus,
} from "./mock-routes-orders";
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
/** File mẫu tĩnh cho URL ký giả lập (`public/mock/design-artifacts/`). */
const MOCK_ARTIFACT_DIR = "/mock/design-artifacts";

const newestFirst = (a: MockTask, b: MockTask) => b.createdAt.localeCompare(a.createdAt);

/**
 * BE `requireWarehouseAssignee`: ACTIVE + WAREHOUSE_STAFF hoặc WAREHOUSE_MANAGER. Đây là điều kiện của
 * NGƯỜI ĐƯỢC GÁN (ai nhận việc), không phải quyền của người gọi — nên vẫn đọc vai trò.
 */
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

/**
 * BE `TaskAccess.requireVisible` (BE PR #148): người được gán; người có task-oversight:READ hoặc
 * design-reverification:READ; và người đóng gói (packing:UPDATE) khi lấy hàng đã xong — người đóng gói
 * không nhất thiết là người lấy hàng.
 */
function canSee(task: MockTask, actor: MockActor): boolean {
  return (
    task.assignedUserId === actor.userId ||
    actor.can(OVERSIGHT.read) ||
    actor.can(REVERIFY.read) ||
    (task.pickStatus === "PICKED" && actor.can(PACKING.update))
  );
}

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
    const all = [...(await getFulfillmentStore()).values()]
      .filter((task) => !status || task.pickStatus === status)
      .sort(newestFirst);
    // BE `listTasks`: endpoint cần pick-lists:READ; phạm vi theo quyền — task-oversight:READ thấy hết →
    // design-reverification:READ chỉ thấy kiện đang giữ → còn lại thấy task của mình
    if (!actor.can(PICK.read)) return forbidden();
    let visible: MockTask[];
    if (actor.can(OVERSIGHT.read)) visible = all;
    else if (actor.can(REVERIFY.read)) visible = all.filter((t) => t.packStatus === "ON_HOLD");
    else visible = all.filter((t) => t.assignedUserId === actor.userId);
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
      if (!actor.can(PACK.read)) return forbidden();
      if (!task) return taskNotFound();
      // BE `requireArtifactAccess`: người được gán, người có design-reverification:READ, hoặc người đóng
      // gói (packing:UPDATE) khi lấy hàng đã xong — không có điều phối
      if (
        task.assignedUserId !== actor.userId &&
        !actor.can(REVERIFY.read) &&
        !(task.pickStatus === "PICKED" && actor.can(PACKING.update))
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
      // BE trả URL ký http(s) (presigned) — mock trỏ tới file mẫu tĩnh trong `public/mock/`
      const file = preview ? "customer-preview.svg" : "artifact.txt";
      const url = new URL(`${MOCK_ARTIFACT_DIR}/${file}`, window.location.origin);
      url.searchParams.set("design", line.designId);
      url.searchParams.set("role", role);
      return beOk({
        artifactId: `ART-${line.designId}-${role}`,
        role,
        originalName: `${line.designId}-${role.toLowerCase()}.${preview ? "svg" : "txt"}`,
        contentType: preview ? "image/svg+xml" : "text/plain",
        sizeBytes: 1024,
        checksum: lockedChecksumOf(line),
        url: url.href,
        expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
      });
    },
  );
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
    const now = new Date().toISOString();
    const task: MockTask = {
      taskId: nextTaskId(),
      orderId,
      orderNumber: order.orderNumber,
      warehouseId: order.fulfillmentWarehouseId,
      assignedUserId,
      pickStatus: "PENDING",
      packStatus: "PENDING",
      assignedAt: now,
      createdAt: now,
      evidence: [],
    };
    store.set(task.taskId, task);
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

/** Đóng gói (nhận đơn, kiện, quét, hoàn tất) ở `mock-routes-packing.ts`; ở đây còn kiểm tra lại thiết kế. */
function registerPackRoutes(): void {
  registerMockRoute("POST", `${PATH}/:id/design-integrity-reverification`, async (config) => {
    const { task, actor } = await loadTask(config);
    if (!actor.can(REVERIFY.update)) return forbidden();
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
      // BE PR #136: kiểm tra lại đạt → gỡ giữ DESIGN_MISMATCH, phiên về PACKING (docs 08 §5
      // "Verification Failed → In Progress"); người đóng gói hoàn tất lại, đơn chưa PACKED
      task.packStatus = "PACKING";
      resolveMockDesignHold(task.orderId);
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
        roles: toBackendRoles(user.roles),
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
  registerPackingMockRoutes();
  registerUserRoutes();
}
