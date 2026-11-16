/**
 * Mock trạm kiểm thùng — store phiên kiểm thùng + dựng dữ liệu từ dòng lấy hàng của task (BE 4C-6, docs 08).
 *
 * Mỗi thùng là một dòng lấy hàng đã `PICKED` của task (docs 08 BR-05) với LPN của dòng đó. Phiên dựng lười lần đầu đọc và
 * nhận thêm thùng mới được lấy sau đó (BE `receive`). Task seed IN_PROGRESS có sẵn một thùng đã dán nhãn và vào shipment
 * giao một phần; task COMPLETED có mọi thùng đã dán nhãn trong một shipment; task CANCELLED có thùng bị loại (đơn huỷ).
 * ASSUMPTION (mock-only): dòng hàng của đơn không có dòng lấy hàng (dòng in theo thiết kế) không có thùng nên không tính
 * vào số cần giao; mọi SKU có quy cách thùng 40 × 30 × 25 cm, 6,5 kg, trừ SKU đặt qua `setMockUnmeasuredSkus`.
 */

import { getMockPickLines } from "./mock-routes-pick-lines-store";
import { DIM_DIVISOR } from "./mock-carton-check-session";

import type { Order } from "@/lib/mock-data";
import type { MockCarton, MockCartonSpec, MockCheckSession } from "./mock-carton-check-session";
import type { MockTask } from "./mock-routes-fulfillment-store";

const sessions = new Map<string, MockCheckSession>();
let unmeasuredSkus: ReadonlySet<string> = new Set();

export function resetCartonCheckMockStore(): void {
  sessions.clear();
  unmeasuredSkus = new Set();
}

/** Mọi phiên đã dựng (taskId → phiên) — tra `requestId` đã hoàn tất ở task khác. */
export const builtCheckSessions = (): ReadonlyMap<string, MockCheckSession> => sessions;

/** Đặt các SKU thiếu quy cách thùng (docs 08 BR-07) — để test nhánh `CARTON_SPEC_UNMEASURED`. */
export function setMockUnmeasuredSkus(skus: readonly string[]): void {
  unmeasuredSkus = new Set(skus);
}

export const MOCK_CARTON_SPEC: MockCartonSpec = {
  lengthCm: 40,
  widthCm: 30,
  heightCm: 25,
  weightKg: 6.5,
  rotatable: true,
};

/** Quy cách thùng của các SKU đã khai báo (SKU thiếu quy cách không có trong bản đồ). */
export function mockCartonSpecs(skus: readonly string[]): Map<string, MockCartonSpec> {
  return new Map(
    skus.filter((sku) => !unmeasuredSkus.has(sku)).map((sku) => [sku, MOCK_CARTON_SPEC]),
  );
}

export const unmeasuredSkusOf = (skus: readonly string[]): string[] =>
  [...new Set(skus.filter((sku) => unmeasuredSkus.has(sku)))].sort();

interface TaskFacts {
  taskId: string;
  packStatus: string;
  assignedUserId: string;
  startedAt?: string;
  packedAt?: string;
}

const dimWeightOf = (spec: MockCartonSpec) =>
  Math.round(((spec.lengthCm * spec.widthCm * spec.heightCm) / DIM_DIVISOR) * 1000) / 1000;

function labelSeeded(carton: MockCarton, at: string): void {
  Object.assign(carton, {
    status: "LABELED",
    checkedAt: at,
    labeledAt: at,
    labelVersion: 1,
    lengthCm: MOCK_CARTON_SPEC.lengthCm,
    widthCm: MOCK_CARTON_SPEC.widthCm,
    heightCm: MOCK_CARTON_SPEC.heightCm,
    weightKg: MOCK_CARTON_SPEC.weightKg,
    dimWeightKg: dimWeightOf(MOCK_CARTON_SPEC),
    rotatable: MOCK_CARTON_SPEC.rotatable,
  });
}

function seedProgress(session: MockCheckSession, task: TaskFacts, order: Order): void {
  const at = task.packedAt ?? task.startedAt ?? new Date().toISOString();
  const { cartons } = session;
  if (task.packStatus === "COMPLETED") {
    cartons.forEach((carton) => labelSeeded(carton, at));
  } else if (task.packStatus === "IN_PROGRESS") {
    const [first, second] = cartons;
    if (first) labelSeeded(first, at);
    if (second) Object.assign(second, { status: "CHECKED", checkedAt: at });
  } else if (task.packStatus === "CANCELLED") {
    cartons.forEach((carton) =>
      Object.assign(carton, { status: "REMOVED", removalReason: "ORDER_CANCELLED" }),
    );
    return;
  } else {
    return;
  }
  const shipped = cartons.filter((carton) => carton.status === "LABELED");
  if (shipped.length === 0) return;
  const shipment = {
    shipmentId: `${session.taskId}-shp-1`,
    code: `${order.orderNumber}-S1`,
    status: "READY_TO_DISPATCH",
    packageCount: shipped.length,
    partial: task.packStatus === "IN_PROGRESS",
    partialNote: task.packStatus === "IN_PROGRESS" ? "Giao trước phần đã có" : undefined,
    readyAt: at,
  };
  session.shipments.push(shipment);
  shipped.forEach((carton) => (carton.shipmentId = shipment.shipmentId));
}

/** BE `CartonCheck.receive`: thùng của các dòng lấy hàng PICKED mà phiên chưa có → To Check. */
export async function receiveCartons(session: MockCheckSession, task: MockTask): Promise<void> {
  const lines = (await getMockPickLines(task)).filter((line) => line.status === "PICKED");
  for (const line of lines) {
    if (session.cartons.some((carton) => carton.pickLineId === line.lineId)) continue;
    const packageNo = session.cartons.length + 1;
    session.cartons.push({
      packageId: `${session.taskId}-ctn-${packageNo}`,
      packageNo,
      labelCode: `${session.orderNumber}-${packageNo}`,
      lpn: line.lpn,
      pickLineId: line.lineId,
      orderLineId: line.orderLineId,
      sku: line.sku,
      lotNumber: line.lotNumber,
      quantity: line.allocatedQty,
      status: "TO_CHECK",
      labelVersion: 0,
      rotatable: true,
    });
  }
}

export async function getCheckSession(
  task: MockTask,
  order: Order,
  userName: (userId: string) => Promise<string | undefined>,
): Promise<MockCheckSession> {
  let session = sessions.get(task.taskId);
  if (!session) {
    session = { taskId: task.taskId, orderNumber: order.orderNumber, cartons: [], shipments: [] };
    sessions.set(task.taskId, session);
    await receiveCartons(session, task);
    if (task.packStatus !== "PENDING" && task.packStatus !== "CANCELLED") {
      session.startedBy = task.assignedUserId;
      session.startedByName = await userName(task.assignedUserId);
      session.startedAt = task.startedAt ?? new Date().toISOString();
      session.completedAt = task.packedAt;
    }
    seedProgress(session, task, order);
  }
  // BE `OrderCancellationListener`: đơn huỷ → thùng chưa vào shipment bị loại (ORDER_CANCELLED)
  if (task.packStatus === "CANCELLED") {
    for (const carton of session.cartons) {
      if (carton.status === "REMOVED" || carton.shipmentId) continue;
      Object.assign(carton, { status: "REMOVED", removalReason: "ORDER_CANCELLED" });
    }
  }
  return session;
}
