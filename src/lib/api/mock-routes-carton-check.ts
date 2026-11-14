/**
 * Mock routes — trạm kiểm thùng & dán nhãn giao hàng (docs 08), khớp BE `CartonCheckController` + `POST
 * /tasks/{id}/packing-completion` (4C-6). Chỉ dùng khi USE_MOCK=true.
 *
 * Giữ đúng hành vi BE: mã lỗi nghiệp vụ riêng (PACKING_TAKEN, PACKING_NOT_READY, CARTON_*, PACK_*), quản lý kho
 * (`packing:APPROVE`) không bị PACKING_TAKEN, quét lại / dán nhãn lại / loại lại trả 200 không đổi gì, in lại có
 * `fromVersion`, hoàn tất có `requestId`. Trạng thái phiên theo `PackStatus` của BE (PENDING / IN_PROGRESS / COMPLETED /
 * CANCELLED).
 */

import { FULFILLMENT_PACKAGE_PERMISSIONS, FULFILLMENT_PACKING_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  checkMockCarton,
  findMockCarton,
  labelMockCartons,
  planMockCompletion,
  removeMockCarton,
  reprintMockCarton,
} from "./mock-carton-check-session";
import { PackError } from "./mock-pack-error";
import { mockShippingLabelsPdf } from "./mock-shipping-labels-pdf";
import { builtCheckSessions, getCheckSession } from "./mock-routes-carton-check-store";
import {
  omitUndefined,
  sessionView,
  specsOf,
  taskPaymentDueOf,
  wantedUnitsOf,
} from "./mock-routes-carton-check-view";
import {
  conflict,
  currentActor,
  findMockOrder,
  forbidden,
  getFulfillmentStore,
  routeParam,
  taskNotFound,
  toTaskResponse,
} from "./mock-routes-fulfillment-store";
import {
  backendOrderStatusOf,
  mockOrderAllowsPartialShipment,
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
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Order } from "@/lib/mock-data";
import type { MockCheckSession } from "./mock-carton-check-session";
import type { MockActor, MockTask } from "./mock-routes-fulfillment-store";

const BASE = "/fulfillment";
const TASK = `${BASE}/tasks/:id`;
/** BE: xem hàng chờ / phiên = packages:READ; ghi = packing:UPDATE; in PDF nhãn = packing:READ. */
const READ_QUEUE = FULFILLMENT_PACKAGE_PERMISSIONS.read;
const WORK = FULFILLMENT_PACKING_PERMISSIONS.update;
const READ_LABELS = FULFILLMENT_PACKING_PERMISSIONS.read;
/** BE `CartonCheckService.WORKABLE`: đơn còn ở khâu kho. */
const WORKABLE = ["READY_TO_FULFILL", "PICKING", "PARTIALLY_FULFILLED"];
const QUEUED = ["PENDING", "IN_PROGRESS"];
const SELECTION_MAX = 500;
const LPN_MAX = 30;

type Failure = ReturnType<typeof beError>;
type Reply = { status: number; data: unknown; headers: Record<string, string> };
interface Ctx {
  task: MockTask;
  order: Order;
  session: MockCheckSession;
  actor: MockActor;
  /** packing:APPROVE — làm thay / tiếp quản phiên của người khác (không bị PACKING_TAKEN). */
  manager: boolean;
}

const asFailure = (error: unknown): Failure => {
  if (error instanceof PackError)
    return beError(error.status, error.code, error.message, error.fields);
  throw error;
};

/** BE `WarehouseScope`: nhân viên chỉ thấy kho của mình (mock: `staffUsers.warehouseIds`). */
async function inScope(actor: MockActor, warehouseId: string): Promise<boolean> {
  const { staffUsers } = await import("@/lib/mock-data");
  const ids = staffUsers.find((u) => u.userId === actor.userId)?.warehouseIds;
  return !ids || ids.length === 0 || ids.some((id) => id === warehouseId);
}

const userName = async (userId: string) => {
  const { staffUsers } = await import("@/lib/mock-data");
  return staffUsers.find((u) => u.userId === userId)?.fullName;
};

/** Khung chung: quyền → task → kho → (ghi) lấy hàng xong → phiên. */
async function load(
  config: AxiosRequestConfig,
  permission: PermissionCode,
  work: boolean,
): Promise<Ctx | Failure> {
  const actor = await currentActor();
  if (!actor.can(permission)) return forbidden();
  const task = (await getFulfillmentStore()).get(routeParam(config, "id"));
  const order = task ? await findMockOrder(task.orderId) : undefined;
  if (!task || !order) return taskNotFound();
  if (!(await inScope(actor, order.fulfillmentWarehouseId))) {
    return beError(403, "OUT_OF_DATA_SCOPE", "The warehouse is outside your data scope");
  }
  if (work) {
    if (task.pickStatus === "CANCELLED") {
      return beError(409, "PICK_TASK_STATE_CONFLICT", "The task was cancelled with its order");
    }
    if (task.pickStatus !== "PICKED") {
      return beError(
        409,
        "PACKING_NOT_READY",
        `Picking is ${task.pickStatus}; the check starts once every carton is at the dispatch area (08 BR-01)`,
      );
    }
  }
  const session = await getCheckSession(task, order, userName);
  return {
    task,
    order,
    session,
    actor,
    manager: actor.can(FULFILLMENT_PACKING_PERMISSIONS.approve),
  };
}

const failed = (value: Ctx | Failure): value is Failure => "status" in value && "data" in value;

/** BE `requireWorkable` (đơn): đơn còn ở khâu kho. */
async function requireOrderWorkable(ctx: Ctx): Promise<Failure | null> {
  const status = await backendOrderStatusOf(ctx.order.orderId);
  if (status && WORKABLE.includes(status)) return null;
  return beError(
    409,
    "PACK_STATE_CONFLICT",
    `The order is ${status ?? "UNKNOWN"}; its cartons cannot change now`,
  );
}

/** BE `CartonCheck.requireOwner`: chỉ người bắt đầu phiên hoặc người có packing:APPROVE. */
function requireOwner(ctx: Ctx): Failure | null {
  if (ctx.manager || ctx.session.startedBy === ctx.actor.userId) return null;
  return beError(
    409,
    "PACKING_TAKEN",
    `Another worker is checking order ${ctx.order.orderNumber}; a warehouse manager may step in`,
  );
}

/** BE `CartonCheck.requireWorkable`: chỉ khi IN_PROGRESS, và chỉ người bắt đầu hoặc quản lý kho. */
function requireWorkable(ctx: Ctx): Failure | null {
  if (ctx.task.packStatus !== "IN_PROGRESS") {
    return beError(
      409,
      "PACK_STATE_CONFLICT",
      ctx.task.packStatus === "PENDING"
        ? `Start the check of order ${ctx.order.orderNumber} first`
        : `The check of order ${ctx.order.orderNumber} is ${ctx.task.packStatus}`,
    );
  }
  return requireOwner(ctx);
}

/** BE `CartonCheck.requireReprintable`: IN_PROGRESS hoặc COMPLETED, và chỉ người bắt đầu / quản lý kho. */
function requireReprintable(ctx: Ctx): Failure | null {
  if (ctx.task.packStatus === "PENDING" || ctx.task.packStatus === "CANCELLED") {
    return beError(
      409,
      "PACK_STATE_CONFLICT",
      `The check of order ${ctx.order.orderNumber} is ${ctx.task.packStatus}`,
    );
  }
  return requireOwner(ctx);
}

const view = (ctx: Ctx) => sessionView(ctx.session, ctx.task.packStatus, ctx.order);

/** Chạy một thao tác ghi: nạp ngữ cảnh → quyền → (đơn còn đóng được) → quyền làm việc → thao tác; `PackError` → lỗi BE. */
async function write(
  config: AxiosRequestConfig,
  run: (ctx: Ctx) => Reply | Failure,
  checks: { orderWorkable: boolean; guard: (ctx: Ctx) => Failure | null } = {
    orderWorkable: true,
    guard: requireWorkable,
  },
): Promise<Reply | Failure> {
  const ctx = await load(config, WORK, true);
  if (failed(ctx)) return ctx;
  const blocked =
    (checks.orderWorkable ? await requireOrderWorkable(ctx) : null) ?? checks.guard(ctx);
  if (blocked) return blocked;
  try {
    return run(ctx);
  } catch (error) {
    return asFailure(error);
  }
}

/** Tên LPN trong đường dẫn / body: `@Size(max = 30)`. */
const lpnParam = (config: AxiosRequestConfig) => routeParam(config, "lpn");

function registerReads(): void {
  registerMockRoute("GET", `${BASE}/packing-queue`, async (config) => {
    const actor = await currentActor();
    if (!actor.can(READ_QUEUE)) return forbidden();
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    const status = readString(params.status).toUpperCase();
    if (status && ![...QUEUED, "COMPLETED", "CANCELLED"].includes(status)) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unknown check status");
    }
    const warehouseId = readString(params.warehouseId);
    if (warehouseId && !(await inScope(actor, warehouseId))) {
      return beError(403, "OUT_OF_DATA_SCOPE", "The warehouse is outside your data scope");
    }
    const rows: { pickedAt: string; row: Record<string, unknown> }[] = [];
    for (const task of (await getFulfillmentStore()).values()) {
      const order = await findMockOrder(task.orderId);
      if (
        !order ||
        task.pickStatus !== "PICKED" ||
        !(await inScope(actor, order.fulfillmentWarehouseId))
      )
        continue;
      if (warehouseId && order.fulfillmentWarehouseId !== warehouseId) continue;
      if (!(status ? [status] : QUEUED).includes(task.packStatus)) continue;
      // BE `WORKABLE`: đơn còn ở khâu kho (đơn đang treo / đã huỷ không vào hàng chờ)
      const orderStatus = await backendOrderStatusOf(order.orderId);
      if (!(orderStatus && WORKABLE.includes(orderStatus))) continue;
      const session = await getCheckSession(task, order, userName);
      const live = session.cartons.filter((c) => c.status !== "REMOVED");
      rows.push({
        pickedAt: task.pickedAt ?? "",
        row: omitUndefined({
          taskId: task.taskId,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          warehouseId: order.fulfillmentWarehouseId,
          status: task.packStatus,
          pickedAt: task.pickedAt,
          pickerName: await userName(task.assignedUserId),
          startedBy: session.startedBy,
          startedByName: session.startedByName,
          startedAt: session.startedAt,
          cartonCount: live.length,
          checkedCount: live.filter((c) => c.status !== "TO_CHECK").length,
          labeledCount: live.filter((c) => c.status === "LABELED").length,
          shipmentCount: session.shipments.filter((s) => s.status !== "CANCELLED").length,
        }),
      });
    }
    rows.sort((a, b) => a.pickedAt.localeCompare(b.pickedAt));
    return beOk(
      bePage(
        rows.map((r) => r.row),
        page,
        size,
      ),
    );
  });

  registerMockRoute("GET", `${TASK}/packing-session`, async (config) => {
    const ctx = await load(config, READ_QUEUE, false);
    return failed(ctx) ? ctx : beOk(view(ctx));
  });
}

/** BE `CartonSelectionRequest`: `lpns` @Size(max = 500), mỗi LPN @NotBlank @Size(max = 30); body có thể vắng. */
function selectionOf(config: AxiosRequestConfig): string[] | Failure {
  const body = parseJsonBody(config.data);
  const raw: unknown = body.lpns;
  if (raw === undefined || raw === null) return [];
  const invalid = (message: string) =>
    beError(400, "VALIDATION_FAILED", "Invalid request data", [{ field: "lpns", message }]);
  if (!Array.isArray(raw) || raw.length > SELECTION_MAX) return invalid("size must be at most 500");
  const lpns = raw.map(readString);
  return lpns.some((lpn) => !lpn.trim() || lpn.length > LPN_MAX)
    ? invalid("each lpn must be 1 to 30 characters")
    : lpns;
}

function registerSessionWrites(): void {
  registerMockRoute("POST", `${TASK}/packing-start`, async (config) => {
    const ctx = await load(config, WORK, true);
    if (failed(ctx)) return ctx;
    const blocked = await requireOrderWorkable(ctx);
    if (blocked) return blocked;
    const { task, session, actor } = ctx;
    if (task.packStatus === "PENDING") {
      task.packStatus = "IN_PROGRESS";
      session.startedBy = actor.userId;
      session.startedByName = await userName(actor.userId);
      session.startedAt = new Date().toISOString();
      task.startedAt ??= session.startedAt;
    } else if (task.packStatus === "IN_PROGRESS") {
      const taken = requireOwner(ctx);
      if (taken) return taken;
    } else if (task.packStatus === "CANCELLED") {
      return beError(
        409,
        "PACK_STATE_CONFLICT",
        `The check of order ${ctx.order.orderNumber} was cancelled with the order`,
      );
    }
    return beOk(view(ctx));
  });

  registerMockRoute("POST", `${TASK}/carton-checks`, (config) =>
    write(config, (ctx) => {
      const lpn = readString(parseJsonBody(config.data).lpn);
      if (!lpn.trim() || lpn.length > LPN_MAX) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "lpn", message: "must not be blank", code: "NotBlank" },
        ]);
      }
      checkMockCarton(ctx.session, lpn, new Date().toISOString());
      return beOk(view(ctx));
    }),
  );

  registerMockRoute("POST", `${TASK}/carton-labels`, (config) =>
    write(config, (ctx) => {
      const lpns = selectionOf(config);
      if (!Array.isArray(lpns)) return lpns;
      labelMockCartons(ctx.session, lpns, specsOf(ctx.session), new Date().toISOString());
      return beOk(view(ctx));
    }),
  );
}

function registerCartonWrites(): void {
  registerMockRoute("POST", `${TASK}/cartons/:lpn/label-reprint`, (config) =>
    write(
      config,
      (ctx) => {
        const raw = readParams(config).fromVersion;
        const fromVersion = raw === undefined ? undefined : readInt(raw, 0);
        if (fromVersion !== undefined && fromVersion < 1) {
          return beError(400, "VALIDATION_FAILED", "Invalid request data", [
            { field: "fromVersion", message: "must be at least 1" },
          ]);
        }
        const lpn = lpnParam(config);
        const spec = specsOf(ctx.session).get(findMockCarton(ctx.session, lpn).sku);
        reprintMockCarton(ctx.session, lpn, fromVersion, spec);
        return beOk(view(ctx));
      },
      { orderWorkable: false, guard: requireReprintable },
    ),
  );

  registerMockRoute("POST", `${TASK}/cartons/:lpn/removal`, (config) =>
    write(config, (ctx) => {
      const note = readString(parseJsonBody(config.data).note);
      if (note.length > 500) {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "note", message: "size must be at most 500" },
        ]);
      }
      removeMockCarton(ctx.session, lpnParam(config), note || undefined);
      return beOk(view(ctx));
    }),
  );

  // BE: nhãn giao hàng dạng PDF (mỗi thùng một trang). Chỉ cần packing:READ; không đổi gì ở BE.
  registerMockRoute("POST", `${TASK}/shipping-labels`, async (config) => {
    const ctx = await load(config, READ_LABELS, false);
    if (failed(ctx)) return ctx;
    const lpns = selectionOf(config);
    if (!Array.isArray(lpns)) return lpns;
    try {
      const chosen =
        lpns.length === 0
          ? ctx.session.cartons.filter((c) => c.status === "LABELED" && !c.shipmentId)
          : lpns.map((lpn) => {
              const carton = findMockCarton(ctx.session, lpn);
              if (carton.status !== "LABELED") {
                throw new PackError(
                  409,
                  "CARTON_NOT_CHECKED",
                  `Carton ${carton.lpn} is ${carton.status}: only a labelled carton has a shipping label to print`,
                );
              }
              return carton;
            });
      if (chosen.length === 0) {
        throw new PackError(
          409,
          "CARTON_NOT_CHECKED",
          `No labelled carton of order ${ctx.order.orderNumber} waits to ship`,
        );
      }
      return {
        status: 200,
        data: mockShippingLabelsPdf(ctx.order, chosen),
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="shipping-labels-${ctx.order.orderNumber}.pdf"`,
        },
      };
    } catch (error) {
      return asFailure(error);
    }
  });
}

/** Hoàn tất kiểm thùng (BE `CartonCheckService.complete`): thùng đã dán nhãn chưa vào shipment → MỘT shipment READY_TO_DISPATCH. */
function registerCompletion(): void {
  registerMockRoute("POST", `${TASK}/packing-completion`, async (config) => {
    const ctx = await load(config, WORK, true);
    if (failed(ctx)) return ctx;
    const { task, order, session } = ctx;
    const body = parseJsonBody(config.data);
    const requestId = readString(body.requestId) || undefined;
    const respond = (shipmentId?: string) =>
      beOk(
        omitUndefined({
          ...toTaskResponse(task),
          shipmentId,
          // Cảnh báo, không chặn (docs 08 BR-11): hoàn tất vẫn thành công
          paymentDue: shipmentId ? taskPaymentDueOf(order) : undefined,
        }),
      );
    if (requestId) {
      for (const [taskId, sibling] of builtCheckSessions()) {
        const replay = sibling.shipments.find((s) => s.requestId === requestId);
        if (replay) {
          return taskId === task.taskId
            ? respond(replay.shipmentId)
            : conflict("That request id completed another task");
        }
      }
    }
    if (task.packStatus === "COMPLETED") return respond(session.shipments.at(-1)?.shipmentId);
    const blocked = requireWorkable(ctx) ?? (await requireOrderWorkable(ctx));
    if (blocked) return blocked;
    if (typeof body.note === "string" && body.note.length > 500) {
      return beError(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "note", message: "size must be at most 500" },
      ]);
    }
    try {
      const plan = planMockCompletion(
        session,
        wantedUnitsOf(order, session),
        body.partial === true,
        await mockOrderAllowsPartialShipment(order.orderId),
        readString(body.note) || undefined,
      );
      const now = new Date().toISOString();
      const shipment = {
        shipmentId: crypto.randomUUID(),
        code: `${order.orderNumber}-S${session.shipments.length + 1}`,
        status: "READY_TO_DISPATCH",
        packageCount: plan.cartons.length,
        partial: plan.partial,
        partialNote: plan.partial ? readString(body.note).trim() : undefined,
        readyAt: now,
        requestId,
      };
      session.shipments.push(shipment);
      plan.cartons.forEach((carton) => (carton.shipmentId = shipment.shipmentId));
      if (!plan.partial) {
        task.packStatus = "COMPLETED";
        task.packedAt = now;
        session.completedAt = now;
        setMockOrderStatus(order.orderId, "PACKED");
      }
      return respond(shipment.shipmentId);
    } catch (error) {
      return asFailure(error);
    }
  });
}

export function registerCartonCheckMockRoutes(): void {
  registerReads();
  registerSessionWrites();
  registerCartonWrites();
  registerCompletion();
}
