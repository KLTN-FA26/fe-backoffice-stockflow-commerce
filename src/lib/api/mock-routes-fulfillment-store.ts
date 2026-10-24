/**
 * Mock fulfillment task — store in-memory + helper cho `mock-routes-fulfillment.ts`.
 *
 * Wire shape = BE `FulfillmentTaskResponse` (SCRUM-43). Task seed dựng từ đơn có sẵn trong
 * `mock-data.ts` theo trạng thái đơn (không thêm bản ghi mới): dòng có `designId` là dòng tuỳ
 * chỉnh, mang snapshot + checksum như BE.
 */

import { mockGrantsOf } from "./mock-user-grants";
import { resetPackingMockStore } from "./mock-routes-packing-store";
import {
  backendOrderStatusOf,
  fakeSha256,
  lockedChecksumOf,
  putMockOrderOnDesignHold,
  setMockOrderStatus,
  snapshotIdOf,
} from "./mock-routes-orders-store";
import { beError, isRecord } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderStatus } from "@/lib/mock-data";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type MockPickStatus = "PENDING" | "PICKING" | "PICKED" | "SHORT" | "CANCELLED";
export type MockPackStatus = "PENDING" | "PACKING" | "ON_HOLD" | "PACKED" | "CANCELLED";

export interface MockEvidence {
  orderLineId: string;
  snapshotId: string;
  expectedChecksum: string;
  actualChecksum: string;
  matching: boolean;
  verifiedAt: string;
}

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
  /** Append-only; trả ra mới nhất trước như BE. */
  evidence: MockEvidence[];
}

interface SeedSpec {
  pick: MockPickStatus;
  pack: MockPackStatus;
  assignee: string;
  /**
   * ASSUMPTION (mock-only): file thiết kế trong kho lưu trữ bị lệch so với bản đã chốt; số là số
   * lần kiểm tra lại còn thất bại trước khi coi như QC đã khôi phục đúng file.
   */
  tamperedReverifyFailures?: number;
}

/**
 * Đơn mock theo trạng thái → task seed. Có task thì đơn đã ở khâu kho (BE PR #133: tạo task chuyển
 * READY_TO_FULFILL → PICKING), nên `getFulfillmentStore` đặt trạng thái BE của đơn cho khớp. Đơn
 * `Confirmed` không có task: coi như đã được điều phối release (READY_TO_FULFILL) để demo tạo task.
 */
const SEED_BY_ORDER_STATUS: Partial<Record<OrderStatus, SeedSpec>> = {
  "Ready to Fulfill": {
    pick: "PENDING",
    pack: "PENDING",
    assignee: "USER-WH-01",
    tamperedReverifyFailures: 1,
  },
  Picking: { pick: "PICKING", pack: "PENDING", assignee: "USER-WH-02" },
  "Partially Fulfilled": {
    pick: "PICKED",
    pack: "ON_HOLD",
    assignee: "USER-WH-01",
    tamperedReverifyFailures: 0,
  },
  Packed: { pick: "PICKED", pack: "PACKED", assignee: "USER-WH-03" },
  Cancelled: { pick: "CANCELLED", pack: "CANCELLED", assignee: "USER-WH-02" },
};

let store: Map<string, MockTask> | undefined;
/** orderId → số lần kiểm tra lại còn thất bại (có key = file đang lệch). */
const tampered = new Map<string, number>();
let sequence = 0;

export function resetFulfillmentMockStore(): void {
  resetPackingMockStore();
  store = undefined;
  tampered.clear();
  sequence = 0;
}

export async function findMockOrder(orderId: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((order) => order.orderId === orderId);
}

export const isTampered = (orderId: string) => tampered.has(orderId);

/**
 * BE `verifyAll`: mỗi dòng có thiết kế ghi một evidence. Trả `true` nếu mọi dòng khớp.
 * `reverify` = lần gọi từ kiểm tra lại (mô phỏng QC khôi phục file sau số lần đã seed).
 */
export function verifyDesigns(
  task: MockTask,
  order: Order,
  reverify: boolean,
  verifiedAt = new Date().toISOString(),
): boolean {
  const failuresLeft = tampered.get(order.orderId);
  if (reverify && failuresLeft !== undefined) {
    if (failuresLeft > 0) tampered.set(order.orderId, failuresLeft - 1);
    else tampered.delete(order.orderId);
  }
  const mismatch = tampered.has(order.orderId);
  for (const line of order.lines) {
    if (!line.designId) continue;
    const expectedChecksum = lockedChecksumOf(line);
    task.evidence.unshift({
      orderLineId: line.lineId,
      snapshotId: snapshotIdOf(line),
      expectedChecksum,
      actualChecksum: mismatch ? fakeSha256(`tampered:${line.lineId}`) : expectedChecksum,
      matching: !mismatch,
      verifiedAt,
    });
  }
  return !mismatch || !order.lines.some((line) => line.designId);
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
    packedAt: spec.pack === "PACKED" ? at(95) : undefined,
    createdAt: at(30),
    evidence: [],
  };
  if (spec.tamperedReverifyFailures !== undefined) {
    tampered.set(order.orderId, spec.tamperedReverifyFailures);
  }
  if (spec.pack === "ON_HOLD") verifyDesigns(task, order, false, at(100));
  return task;
}

/** userId → tên hiển thị (BE trả `assignedUserName` trên task); nạp cùng lúc với store. */
const staffNameById = new Map<string, string>();

export async function getFulfillmentStore(): Promise<Map<string, MockTask>> {
  if (store) return store;
  const { orders, staffUsers } = await import("@/lib/mock-data");
  for (const user of staffUsers) staffNameById.set(user.userId, user.fullName);
  const seeded = new Map<string, MockTask>();
  const used = new Set<OrderStatus>();
  for (const order of orders) {
    const spec = SEED_BY_ORDER_STATUS[order.status];
    // Mỗi trạng thái đơn một task — đủ phủ mọi trạng thái pick/pack
    if (!spec || used.has(order.status)) continue;
    used.add(order.status);
    const task = seedTask(order, spec);
    seeded.set(task.taskId, task);
    if (task.pickStatus === "PENDING") setMockOrderStatus(order.orderId, "PICKING");
    // BE: lệch checksum → đơn ON_HOLD (reason DESIGN_MISMATCH), về lại bước đang làm khi gỡ giữ
    if (task.packStatus === "ON_HOLD") await putMockOrderOnDesignHold(order.orderId);
  }
  const demoOrder = orders.find((order) => order.status === "Confirmed");
  if (demoOrder) setMockOrderStatus(demoOrder.orderId, "READY_TO_FULFILL");
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

/** `FulfillmentTaskResponse` — field chưa có giá trị bị bỏ (Jackson non_null). */
export function toTaskResponse(task: MockTask) {
  const { createdAt: _createdAt, evidence, ...rest } = task;
  return {
    ...rest,
    assignedUserName: staffNameById.get(task.assignedUserId),
    integrityEvidence: evidence.map((entry) => ({ ...entry })),
  };
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

/* ── Lỗi BE (mã chung, message tiếng Anh như FulfillmentServiceImpl) ──── */

export const taskNotFound = () => beError(404, "NOT_FOUND", "Resource not found");
export const forbidden = () => beError(403, "FORBIDDEN", "Access denied");
export const conflict = (message = "Conflicting state") => beError(409, "CONFLICT", message);

/**
 * BE `TaskAccess` (PR #133): task chỉ thao tác được khi đơn ở khâu kho — PICKING, PACKED,
 * PARTIALLY_FULFILLED — hoặc đang ON_HOLD từ một trong số đó.
 */
export async function orderClosedError(orderId: string) {
  const status = await backendOrderStatusOf(orderId);
  if (
    status === "PICKING" ||
    status === "PACKED" ||
    status === "PARTIALLY_FULFILLED" ||
    status === "ON_HOLD"
  ) {
    return null;
  }
  return conflict(`The order is ${status ?? "UNKNOWN"}; this fulfillment task is closed`);
}

export function routeParam(config: AxiosRequestConfig, name: string): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  const value: unknown = isRecord(params) ? params[name] : undefined;
  return typeof value === "string" ? decodeURIComponent(value) : "";
}
