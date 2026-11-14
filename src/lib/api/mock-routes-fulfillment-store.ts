/**
 * Mock fulfillment task — store in-memory + helper cho `mock-routes-fulfillment.ts`.
 *
 * Wire shape = BE `FulfillmentTaskResponse` (SCRUM-43). Task seed dựng từ đơn có sẵn trong
 * `mock-data.ts` theo trạng thái đơn (không thêm bản ghi mới): dòng có `designId` là dòng tuỳ
 * chỉnh, mang snapshot + checksum như BE.
 */

import {
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS as OVERSIGHT,
} from "@/constants";

import { mockGrantsOf } from "./mock-user-grants";
import { resetCartonCheckMockStore } from "./mock-routes-carton-check-store";
import { resetPickLineMockStore, syncCancelledOrders } from "./mock-routes-pick-lines-store";
import {
  MOCK_TO_BACKEND_STATUS,
  backendOrderStatusOf,
  fakeSha256,
  mockOrderCancellations,
  setMockOrderStatus,
  snapshotIdOf,
} from "./mock-routes-orders-store";
import { beError, isRecord } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderStatus } from "@/lib/mock-data";
import type { PermissionCode } from "@/lib/auth/me-permissions";

/** BE `PickStatus` (docs 07 §5.1): STAGED = task đích STAGING đã lấy hết dòng về khu chờ xuất. */
export type MockPickStatus = "PENDING" | "PICKING" | "STAGED" | "PICKED" | "CANCELLED";
/** BE `PackStatus` (docs 08 §5.1). */
export type MockPackStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type MockDestination = "DISPATCH" | "STAGING";

export interface MockTask {
  taskId: string;
  orderId: string;
  /** BE PR #136 trả thêm số đơn + kho trên task. */
  orderNumber: string;
  warehouseId: string;
  assignedUserId: string;
  pickStatus: MockPickStatus;
  packStatus: MockPackStatus;
  assignedAt: string;
  startedAt?: string;
  pickedAt?: string;
  packedAt?: string;
  createdAt: string;
  /** Đích lấy hàng (BE 4C-5): DISPATCH mặc định; STAGING kèm khu chờ xuất của kho. */
  destination: MockDestination;
  stagingLocationCode?: string;
  /** Lúc mọi thùng về khu chờ xuất (pick STAGED) / lúc quản lý kho chuyển cả task sang khu xuất hàng. */
  stagedAt?: string;
  movedToDispatchAt?: string;
  /** Đơn huỷ sau khi đã bắt đầu lấy → hàng đã lấy phải trả về kệ (BE `pick.needs_put_back`). */
  needsPutBack?: boolean;
}

interface SeedSpec {
  pick: MockPickStatus;
  pack: MockPackStatus;
  assignee: string;
}

/**
 * Đơn mock theo trạng thái → task seed. Có task thì đơn đã ở khâu kho (BE PR #133: tạo task chuyển
 * READY_TO_FULFILL → PICKING), nên `getFulfillmentStore` đặt trạng thái BE của đơn cho khớp. Đơn
 * `Confirmed` không có task: coi như đã được điều phối release (READY_TO_FULFILL) để demo tạo task.
 */
const SEED_BY_ORDER_STATUS: Partial<Record<OrderStatus, SeedSpec>> = {
  "Ready to Fulfill": { pick: "PENDING", pack: "PENDING", assignee: "USER-WH-01" },
  Picking: { pick: "PICKING", pack: "PENDING", assignee: "USER-WH-02" },
  // Giao một phần: kiểm thùng đã bắt đầu, đã có shipment đầu, còn thùng chờ kiểm (docs 08 §5.1 In Progress)
  "Partially Fulfilled": { pick: "PICKED", pack: "IN_PROGRESS", assignee: "USER-WH-01" },
  Packed: { pick: "PICKED", pack: "COMPLETED", assignee: "USER-WH-03" },
  Cancelled: { pick: "CANCELLED", pack: "CANCELLED", assignee: "USER-WH-02" },
};

let store: Map<string, MockTask> | undefined;
let sequence = 0;
/** Lần huỷ đơn mock đã đồng bộ sang task (-1 = chưa lần nào). */
let syncedCancellations = -1;

export function resetFulfillmentMockStore(): void {
  syncedCancellations = -1;
  resetPickLineMockStore();
  resetCartonCheckMockStore();
  store = undefined;
  sequence = 0;
}

export async function findMockOrder(orderId: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((order) => order.orderId === orderId);
}

function seedTask(order: Order, spec: SeedSpec): MockTask {
  const at = (minutes: number) =>
    new Date(new Date(order.placedAt).getTime() + minutes * 60_000).toISOString();
  const task: MockTask = {
    taskId: mockTaskId(order.orderId),
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    warehouseId: order.fulfillmentWarehouseId,
    assignedUserId: spec.assignee,
    pickStatus: spec.pick,
    packStatus: spec.pack,
    assignedAt: at(30),
    startedAt: spec.pick === "PICKING" || spec.pick === "PICKED" ? at(45) : undefined,
    pickedAt: spec.pick === "PICKED" ? at(70) : undefined,
    packedAt: spec.pack === "COMPLETED" ? at(95) : undefined,
    createdAt: at(30),
    destination: "DISPATCH",
    // Seed: đơn huỷ sau khi đã lấy — dòng đầu đã lấy chờ trả về kệ (xem `getMockPickLines`)
    needsPutBack: spec.pick === "CANCELLED",
  };
  return task;
}

/** userId → tên hiển thị (BE trả `assignedUserName` trên task); nạp cùng lúc với store. */
const staffNameById = new Map<string, string>();

/**
 * Store task; mỗi lần đọc đồng bộ đơn đã bị huỷ ở mock đơn hàng (BE `OrderCancellationListener` chạy sau sự
 * kiện OrderCancelled) — kéo theo task, dòng mở và cờ trả về kệ.
 */
export async function getFulfillmentStore(): Promise<Map<string, MockTask>> {
  const tasks = await loadStore();
  // Chỉ duyệt lại task khi có đơn vừa bị huỷ, không phải ở mọi request
  const cancellations = mockOrderCancellations();
  if (cancellations !== syncedCancellations) {
    await syncCancelledOrders([...tasks.values()]);
    syncedCancellations = cancellations;
  }
  return tasks;
}

async function loadStore(): Promise<Map<string, MockTask>> {
  if (store) return store;
  const { orders, staffUsers } = await import("@/lib/mock-data");
  for (const user of staffUsers) staffNameById.set(user.userId, user.fullName);
  const seeded = new Map<string, MockTask>();
  const used = new Set<OrderStatus>();
  // Seed chỉ đổi trạng thái đơn còn nguyên như mock-data — không ghi đè vòng đời đã đổi trong phiên (vd đơn
  // đã huỷ trước khi store này nạp; task của nó vẫn seed, rồi bị huỷ theo ở `getFulfillmentStore`)
  const untouched = async (order: Order) =>
    (await backendOrderStatusOf(order.orderId)) === MOCK_TO_BACKEND_STATUS[order.status];
  for (const order of orders) {
    const spec = SEED_BY_ORDER_STATUS[order.status];
    // Mỗi trạng thái đơn một task — đủ phủ mọi trạng thái pick/pack
    if (!spec || used.has(order.status)) continue;
    used.add(order.status);
    const task = seedTask(order, spec);
    seeded.set(task.taskId, task);
    if (!(await untouched(order))) continue;
    if (task.pickStatus === "PENDING") setMockOrderStatus(order.orderId, "PICKING");
  }
  const demoOrder = orders.find((order) => order.status === "Confirmed");
  if (demoOrder && (await untouched(demoOrder))) {
    setMockOrderStatus(demoOrder.orderId, "READY_TO_FULFILL");
  }
  store = seeded;
  return seeded;
}

/** Id dạng UUID như BE (ổn định theo seed) — màn hình hiện 8 ký tự cuối làm mã task. */
function mockTaskId(seed: string): string {
  const hex = fakeSha256(`task:${seed}`);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function nextTaskId(): string {
  sequence += 1;
  return mockTaskId(`new-${sequence}`);
}

/**
 * `FulfillmentTaskResponse.lines` của `GET /tasks/{id}` (SCRUM-466): dòng của đơn, dòng in kèm snapshot thiết kế
 * — cùng nguồn với `toOrderResponse` để số liệu khớp giữa hai endpoint. Danh sách task KHÔNG kèm (như BE).
 */
export async function taskLinesOf(task: MockTask) {
  const order = await findMockOrder(task.orderId);
  return (order?.lines ?? []).map((line) => ({
    lineId: line.lineId,
    sku: line.skuId,
    quantity: line.quantity,
    printLine: !!line.designId,
    ...(line.designId ? { designSnapshotId: snapshotIdOf(line) } : {}),
  }));
}

/** `FulfillmentTaskResponse` — field chưa có giá trị bị bỏ (Jackson non_null). */
export function toTaskResponse(task: MockTask) {
  const { createdAt: _createdAt, ...rest } = task;
  return { ...rest, assignedUserName: staffNameById.get(task.assignedUserId) };
}

/* ── Người gọi ───────────────────────────────────────────────────────── */

export interface MockActor {
  userId: string;
  /** Có mã quyền này không — như `@RequiresPermission` / `CurrentUser.can` của BE (BE PR #148). */
  can: (code: PermissionCode) => boolean;
}

/**
 * Người gọi thật của phiên và quyền của họ (vai trò giả lập chỉ đổi nhãn, không đổi quyền — như BFF
 * mock; quyền lấy từ `mock-user-grants`, cùng nguồn với `/identity/me/permissions`).
 */
export async function currentActor(): Promise<MockActor> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId ?? "";
  const grants = mockGrantsOf(userId);
  return { userId, can: (code) => grants.has(code) };
}

/**
 * BE `TaskAccess.requireVisible` (BE PR #148): người được gán; người có task-oversight:READ; và người đóng gói (packing:UPDATE) khi lấy hàng đã xong — người đóng gói
 * không nhất thiết là người lấy hàng. Dùng chung cho task và dòng lấy hàng.
 */
export function canSee(task: MockTask, actor: MockActor): boolean {
  return (
    task.assignedUserId === actor.userId ||
    actor.can(OVERSIGHT.read) ||
    (task.pickStatus === "PICKED" && actor.can(PACKING.update))
  );
}

/**
 * BE `WarehouseScope.requireWarehouse`: kho nằm ngoài các kho của người gọi → 403 OUT_OF_DATA_SCOPE;
 * người không bị giới hạn kho (danh sách kho rỗng) thì qua.
 */
export async function outOfWarehouseScope(userId: string, warehouseId: string): Promise<boolean> {
  const { staffUsers } = await import("@/lib/mock-data");
  const scope: readonly string[] =
    staffUsers.find((user) => user.userId === userId)?.warehouseIds ?? [];
  return scope.length > 0 && !scope.includes(warehouseId);
}

export const outOfScope = () =>
  beError(403, "OUT_OF_DATA_SCOPE", "The warehouse is outside your data scope");

/* ── Lỗi BE (mã chung, message tiếng Anh như FulfillmentServiceImpl) ──── */

export const taskNotFound = () => beError(404, "NOT_FOUND", "Resource not found");
export const forbidden = () => beError(403, "FORBIDDEN", "Access denied");
export const conflict = (message = "Conflicting state") => beError(409, "CONFLICT", message);

/** BE `TaskAccess.WORKABLE`: trạng thái đơn mà task xuất kho còn thao tác được (kể cả ON_HOLD từ các bước này). */
const WORKABLE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PACKED",
  "PARTIALLY_FULFILLED",
  "ON_HOLD",
]);

/**
 * BE `TaskAccess.orderInFulfilment`: đơn rời khâu kho (vd đã huỷ / đã giao xong) → 409 PICK_TASK_STATE_CONFLICT,
 * task coi như đã đóng.
 */
export async function orderClosedError(orderId: string) {
  const status = await backendOrderStatusOf(orderId);
  if (status && WORKABLE_ORDER_STATUSES.has(status)) return null;
  return beError(
    409,
    "PICK_TASK_STATE_CONFLICT",
    `The order is ${status ?? "UNKNOWN"}; this fulfillment task is closed`,
  );
}

export function routeParam(config: AxiosRequestConfig, name: string): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  const value: unknown = isRecord(params) ? params[name] : undefined;
  return typeof value === "string" ? decodeURIComponent(value) : "";
}
