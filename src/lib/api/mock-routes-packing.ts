/**
 * Mock routes — trạm đóng gói (docs 08), khớp BE `PackingController` + `POST /tasks/{id}/packing-completion`
 * (PR #136, SCRUM-278/281/282). Chỉ dùng khi USE_MOCK=true.
 *
 * Giữ đúng hành vi BE: mã lỗi nghiệp vụ riêng (PACKING_TAKEN, PACK_*, PACKAGE_*), quản lý kho không bị
 * PACKING_TAKEN, retry cùng `scanId` / `requestId` trả 200 không đổi gì, lệch checksum khi hoàn tất vẫn
 * HTTP 200 với pack ON_HOLD và không có `shipmentId`, kiểm tra lại khớp → pack về PACKING.
 */

import { FULFILLMENT_PACKAGE_PERMISSIONS, FULFILLMENT_PACKING_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  PackError,
  applyRemove,
  applyScan,
  openParcel,
  planCompletion,
  reopenParcel,
  sealParcel,
  voidParcel,
} from "./mock-packing-session";
import { builtPackSessions, codOf, getPackSession } from "./mock-routes-packing-store";
import {
  labelView,
  omitUndefined,
  paymentDueOf,
  parcelView,
  sessionView,
} from "./mock-routes-packing-view";
import {
  conflict,
  currentActor,
  findMockOrder,
  forbidden,
  getFulfillmentStore,
  routeParam,
  taskNotFound,
  toTaskResponse,
  verifyDesigns,
} from "./mock-routes-fulfillment-store";
import {
  backendOrderStatusOf,
  mockOrderAllowsPartialShipment,
  putMockOrderOnDesignHold,
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
import type { MockActor, MockTask } from "./mock-routes-fulfillment-store";
import type { PackSessionState } from "./mock-packing-session";

const BASE = "/fulfillment";
const TASK = `${BASE}/tasks/:id`;
/** BE PR #148: xem hàng chờ / phiên = packages:READ; ghi = packing:UPDATE; nhãn = packing:READ. */
const READ_QUEUE = FULFILLMENT_PACKAGE_PERMISSIONS.read;
const PACK_WORK = FULFILLMENT_PACKING_PERMISSIONS.update;
const READ_LABEL = FULFILLMENT_PACKING_PERMISSIONS.read;
const PACKABLE = ["READY_TO_FULFILL", "PICKING", "PARTIALLY_FULFILLED"];
const PACKAGE_TYPES = ["CARTON", "BAG", "PALLET", "CRATE", "OTHER"];
const QUEUED = ["PENDING", "PACKING", "ON_HOLD"];

type Failure = ReturnType<typeof beError>;
type Reply = ReturnType<typeof beOk>;
interface Ctx {
  task: MockTask;
  order: Order;
  state: PackSessionState;
  actor: MockActor;
  /** packing:APPROVE — làm hộ / tiếp quản phiên của người khác (không bị PACKING_TAKEN). */
  canTakeOver: boolean;
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

/** Khung chung: quyền → task → kho → (ghi) lấy hàng xong + đơn còn ở khâu kho → phiên. */
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
      return beError(409, "PACKING_NOT_READY", "Picking must finish before packing starts");
    }
  }
  const state = await getPackSession(task, order, userName);
  return {
    task,
    order,
    state,
    actor,
    canTakeOver: actor.can(FULFILLMENT_PACKING_PERMISSIONS.approve),
  };
}

const failed = (value: Ctx | Failure): value is Failure => "status" in value && "data" in value;

/** BE `requirePackable`: đơn còn ở khâu kho (kể cả đang giữ vì thiết kế — chờ QC). */
async function requirePackable(ctx: Ctx): Promise<Failure | null> {
  const status = await backendOrderStatusOf(ctx.order.orderId);
  if (status && PACKABLE.includes(status)) return null;
  return beError(
    409,
    "PACK_STATE_CONFLICT",
    `The order is ${status ?? "UNKNOWN"}; its parcels cannot change now`,
  );
}

/** BE `requireWorkable`: chỉ khi PACKING, và chỉ người đã nhận đơn hoặc người có packing:APPROVE. */
function requireWorkable(ctx: Ctx): Failure | null {
  if (ctx.task.packStatus !== "PACKING") {
    return beError(
      409,
      "PACK_STATE_CONFLICT",
      ctx.task.packStatus === "PENDING"
        ? "Start packing first"
        : `Packing is ${ctx.task.packStatus}`,
    );
  }
  if (!ctx.canTakeOver && ctx.state.packerId !== ctx.actor.userId) {
    return beError(
      409,
      "PACKING_TAKEN",
      `Another packer is packing order ${ctx.order.orderNumber}`,
    );
  }
  return null;
}

const view = (ctx: Ctx) => sessionView(ctx.state, ctx.task.packStatus, ctx.order);

/** Chạy một thao tác ghi: nạp ngữ cảnh → đơn còn đóng được → quyền làm việc → thao tác; `PackError` → lỗi BE. */
async function write(
  config: AxiosRequestConfig,
  run: (ctx: Ctx) => Reply | Failure,
  checks: { workable: boolean } = { workable: true },
): Promise<Reply | Failure> {
  const ctx = await load(config, PACK_WORK, true);
  if (failed(ctx)) return ctx;
  const blocked = (await requirePackable(ctx)) ?? (checks.workable ? requireWorkable(ctx) : null);
  if (blocked) return blocked;
  try {
    return run(ctx);
  } catch (error) {
    return asFailure(error);
  }
}

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
    if (status && ![...QUEUED, "PACKED", "CANCELLED"].includes(status)) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unknown pack status");
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
      const orderStatus = await backendOrderStatusOf(order.orderId);
      // BE `queueable`: đơn đóng được, hoặc đang giữ riêng vì thiết kế (việc của QC)
      if (!(
        orderStatus &&
        (PACKABLE.includes(orderStatus) ||
          (orderStatus === "ON_HOLD" && task.packStatus === "ON_HOLD"))
      ))
        continue;
      const state = await getPackSession(task, order, userName);
      const live = state.parcels.filter((p) => p.status !== "VOIDED");
      rows.push({
        pickedAt: task.pickedAt ?? "",
        row: omitUndefined({
          taskId: task.taskId,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          warehouseId: order.fulfillmentWarehouseId,
          packStatus: task.packStatus,
          pickedAt: task.pickedAt,
          pickerName: await userName(task.assignedUserId),
          packerId: state.packerId,
          packerName: state.packerName,
          packingStartedAt: state.startedAt,
          packageCount: live.length,
          sealedPackageCount: live.filter((p) => p.status === "SEALED").length,
          shipmentCount: state.shipments.filter((s) => s.status !== "CANCELLED").length,
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

  registerMockRoute("GET", `${TASK}/packages/:pid/label`, async (config) => {
    const ctx = await load(config, READ_LABEL, false);
    if (failed(ctx)) return ctx;
    const parcel = ctx.state.parcels.find((p) => p.packageId === routeParam(config, "pid"));
    if (!parcel) return beError(404, "PACKAGE_NOT_FOUND", "Package not found");
    if (parcel.status !== "SEALED") {
      return beError(
        409,
        "PACKAGE_NOT_SEALED",
        "A package is still open: seal it or take it apart",
      );
    }
    const { warehouses } = await import("@/lib/mock-data");
    const home = warehouses.find((w) => w.warehouseId === ctx.order.fulfillmentWarehouseId);
    const address =
      home &&
      [home.address.street, home.address.ward, home.address.district, home.address.province].join(
        ", ",
      );
    return beOk(
      labelView(
        ctx.state,
        parcel,
        ctx.order,
        home && address ? { name: home.name, address } : undefined,
      ),
    );
  });
}

function registerSessionWrites(): void {
  registerMockRoute("POST", `${TASK}/packing-start`, async (config) => {
    const ctx = await load(config, PACK_WORK, true);
    if (failed(ctx)) return ctx;
    const blocked = await requirePackable(ctx);
    if (blocked) return blocked;
    const { task, state, actor } = ctx;
    if (task.packStatus === "PENDING") {
      task.packStatus = "PACKING";
      state.packerId = actor.userId;
      state.packerName = await userName(actor.userId);
      state.startedAt = new Date().toISOString();
      task.startedAt ??= state.startedAt;
    } else if (task.packStatus === "PACKING") {
      const taken = requireWorkable(ctx);
      if (taken) return taken;
    } else if (task.packStatus !== "PACKED") {
      return conflict(
        task.packStatus === "ON_HOLD"
          ? "Packing is on hold for a design check"
          : `Packing is ${task.packStatus}`,
      );
    }
    return beOk(view(ctx));
  });

  registerMockRoute("POST", `${TASK}/packages`, (config) =>
    write(config, (ctx) => {
      const requested = readString(parseJsonBody(config.data).packageType).toUpperCase();
      if (requested && !PACKAGE_TYPES.includes(requested)) {
        return beError(400, "VALIDATION_FAILED", "Unknown package type", [
          { field: "packageType", message: "unknown" },
        ]);
      }
      const parcel = openParcel(ctx.state, crypto.randomUUID(), requested || "CARTON");
      return beOk(parcelView(ctx.state, parcel), 201);
    }),
  );

  registerMockRoute("POST", `${TASK}/packages/:pid/scans`, (config) =>
    write(config, (ctx) => {
      const body = parseJsonBody(config.data);
      const scanId = readString(body.scanId);
      if (!scanId || !readString(body.scannedCode) || typeof body.quantity !== "number") {
        return beError(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "scanId", message: "must not be null" },
        ]);
      }
      applyScan(ctx.state, {
        scanId,
        packageId: routeParam(config, "pid"),
        scannedCode: readString(body.scannedCode),
        quantity: body.quantity,
        lotNumber: readString(body.lotNumber) || undefined,
        serialNumber: readString(body.serialNumber) || undefined,
        orderLineId: readString(body.orderLineId) || undefined,
      });
      return beOk(view(ctx));
    }),
  );

  registerMockRoute("DELETE", `${TASK}/packages/:pid/lines/:lineId`, (config) =>
    write(config, (ctx) => {
      const params = readParams(config);
      applyRemove(ctx.state, {
        scanId: readString(params.scanId) || crypto.randomUUID(),
        packageId: routeParam(config, "pid"),
        orderLineId: routeParam(config, "lineId"),
        quantity: readInt(params.quantity, 0),
        lotNumber: readString(params.lotNumber) || undefined,
        serialNumber: readString(params.serialNumber) || undefined,
      });
      return beOk(view(ctx));
    }),
  );
}

function registerPackageWrites(): void {
  registerMockRoute("POST", `${TASK}/packages/:pid/seal`, (config) =>
    write(config, (ctx) => {
      const body = parseJsonBody(config.data);
      const num = (v: unknown) => (typeof v === "number" ? v : undefined);
      const flag = (v: unknown) => (typeof v === "boolean" ? v : undefined);
      const parcel = sealParcel(
        ctx.state,
        routeParam(config, "pid"),
        {
          weightKg: num(body.weightKg),
          lengthCm: num(body.lengthCm),
          widthCm: num(body.widthCm),
          heightCm: num(body.heightCm),
          packageType: readString(body.packageType).toUpperCase() || undefined,
          rotatable: flag(body.rotatable),
          fragile: flag(body.fragile),
        },
        new Date().toISOString(),
      );
      return beOk(parcelView(ctx.state, parcel));
    }),
  );

  registerMockRoute("POST", `${TASK}/packages/:pid/reopening`, (config) =>
    write(config, (ctx) =>
      beOk(parcelView(ctx.state, reopenParcel(ctx.state, routeParam(config, "pid")))),
    ),
  );

  registerMockRoute("DELETE", `${TASK}/packages/:pid`, (config) =>
    write(config, (ctx) => {
      voidParcel(ctx.state, routeParam(config, "pid"));
      return beOk(view(ctx));
    }),
  );
}

/** Hoàn tất đóng gói (BE `PackingService.complete`): kiện niêm phong chưa giao → MỘT lô giao READY_TO_DISPATCH. */
function registerCompletion(): void {
  registerMockRoute("POST", `${TASK}/packing-completion`, async (config) => {
    const ctx = await load(config, PACK_WORK, true);
    if (failed(ctx)) return ctx;
    const { task, order, state } = ctx;
    const body = parseJsonBody(config.data);
    const requestId = readString(body.requestId) || undefined;
    const respond = (shipmentId?: string) => {
      const due = shipmentId ? paymentDueOf(order) : undefined;
      return beOk(omitUndefined({ ...toTaskResponse(task), shipmentId, paymentDue: due }));
    };
    if (requestId) {
      for (const [taskId, sibling] of builtPackSessions()) {
        if (sibling.shipments.some((s) => s.requestId === requestId)) {
          return taskId === task.taskId
            ? respond(sibling.shipments.find((s) => s.requestId === requestId)?.shipmentId)
            : conflict("That request id completed another task");
        }
      }
      if (requestId === state.heldRequestId && task.packStatus === "ON_HOLD") return respond();
    }
    if (task.packStatus === "PACKED")
      return respond(state.shipments[state.shipments.length - 1]?.shipmentId);
    const blocked = requireWorkable(ctx) ?? (await requirePackable(ctx));
    if (blocked) return blocked;
    // BE PR #150: giao một phần do Sales bật trên đơn, kho không tự quyết
    if (body.partial === true && !(await mockOrderAllowsPartialShipment(order.orderId))) {
      return beError(
        409,
        "PACK_PARTIAL_NOT_ALLOWED",
        `Order ${order.orderNumber} does not allow partial shipments: ask Sales to allow them on the order`,
      );
    }
    try {
      const plan = planCompletion(state, body.partial === true, readString(body.note) || undefined);
      const printed = state.lines.some((l) => l.printLine && plan.lineTotals.has(l.orderLineId));
      if (printed && !verifyDesigns(task, order, false)) {
        // BR-DSG-003: lệch checksum → giữ phiên + đơn, vẫn HTTP 200, chưa có lô giao
        task.packStatus = "ON_HOLD";
        state.heldRequestId = requestId;
        await putMockOrderOnDesignHold(order.orderId);
        return respond();
      }
      const now = new Date().toISOString();
      const value = [...plan.lineTotals].reduce(
        (sum, [lineId, qty]) =>
          sum + (state.lines.find((l) => l.orderLineId === lineId)?.unitPrice ?? 0) * qty,
        0,
      );
      const shipment = {
        shipmentId: crypto.randomUUID(),
        code: `${order.orderNumber}-S${state.shipments.length + 1}`,
        status: "READY_TO_DISPATCH",
        packageCount: plan.parcels.length,
        codAmount: codOf(order, state.shipments, value),
        value,
        partial: plan.partial,
        partialNote: plan.partial ? readString(body.note) : undefined,
        readyAt: now,
        requestId,
      };
      state.shipments.push(shipment);
      plan.parcels.forEach((p) => (p.shipmentId = shipment.shipmentId));
      if (!plan.partial) {
        task.packStatus = "PACKED";
        task.packedAt = now;
        state.packedAt = now;
        setMockOrderStatus(order.orderId, "PACKED");
      }
      return respond(shipment.shipmentId);
    } catch (error) {
      return asFailure(error);
    }
  });
}

export function registerPackingMockRoutes(): void {
  registerReads();
  registerSessionWrites();
  registerPackageWrites();
  registerCompletion();
}
