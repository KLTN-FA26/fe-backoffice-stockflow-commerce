/**
 * Mock trạm đóng gói — store phiên đóng gói + dựng dữ liệu từ đơn mock (BE PR #136).
 *
 * Phiên dựng lười từ dòng đơn của task. ASSUMPTION (mock-only, mock-data không có lô / serial):
 * dòng thường SL ≥ 4 theo dõi theo lô (hai lô A / B), dòng SKU-004* theo dõi theo serial, dòng in
 * (có `designId`) đã về bàn đóng gói đủ. Task seed đã ON_HOLD / PACKED có sẵn kiện niêm phong cho khớp
 * trạng thái (PACKED còn có lô giao).
 */

import { openParcel } from "./mock-packing-session";
import { fakeSha256, snapshotIdOf } from "./mock-routes-orders";

import type { Order, OrderLine } from "@/lib/mock-data";
import type {
  PackLineState,
  PackSessionState,
  ParcelState,
  ShipmentState,
} from "./mock-packing-session";

interface TaskFacts {
  taskId: string;
  packStatus: string;
  assignedUserId: string;
  startedAt?: string;
  packedAt?: string;
}

const sessions = new Map<string, PackSessionState>();

export function resetPackingMockStore(): void {
  sessions.clear();
}

/** Mọi phiên đã dựng (taskId → phiên) — tra `requestId` đã hoàn tất ở task khác. */
export const builtPackSessions = (): ReadonlyMap<string, PackSessionState> => sessions;

/** Mã vạch giả 13 số, ổn định theo SKU. */
function barcodeOf(sku: string): string {
  const digits = fakeSha256(`barcode:${sku}`).replace(/\D/g, "").padEnd(9, "0").slice(0, 9);
  return `8930${digits}`;
}

function lineState(line: OrderLine): PackLineState {
  const printLine = !!line.designId;
  const lots: Record<string, number> = {};
  if (!printLine && line.quantity >= 4) {
    lots["LOT-2610-A"] = Math.ceil(line.quantity / 2);
    lots["LOT-2610-B"] = Math.floor(line.quantity / 2);
  }
  const serialTracked = !printLine && line.skuId.startsWith("SKU-004");
  return {
    orderLineId: line.lineId,
    sku: line.skuId,
    barcode: barcodeOf(line.skuId),
    printLine,
    designSnapshotId: printLine ? snapshotIdOf(line) : undefined,
    wanted: line.quantity,
    available: line.quantity,
    lots,
    serials: serialTracked
      ? Array.from(
          { length: line.quantity },
          (_, i) => `SN-${line.skuId.slice(4)}-${String(i + 1).padStart(4, "0")}`,
        )
      : [],
    unitPrice: line.unitPrice,
  };
}

/** Một kiện niêm phong chứa MỌI dòng (đúng lô / serial đã lấy) — cho task seed đã qua bước hoàn tất. */
function sealedParcelWithEverything(state: PackSessionState, at: string): ParcelState {
  const parcel = openParcel(state, `${state.taskId}-pkg-1`, "CARTON");
  for (const line of state.lines) {
    const lots = Object.entries(line.lots);
    if (lots.length > 0) {
      lots.forEach(([lotNumber, quantity]) =>
        parcel.contents.push({ orderLineId: line.orderLineId, lotNumber, quantity }),
      );
    } else if (line.serials.length > 0) {
      line.serials.forEach((serialNumber) =>
        parcel.contents.push({ orderLineId: line.orderLineId, serialNumber, quantity: 1 }),
      );
    } else {
      parcel.contents.push({ orderLineId: line.orderLineId, quantity: line.wanted });
    }
  }
  Object.assign(parcel, {
    weightKg: 1.2,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 12,
    dimWeightKg: 1.2,
  });
  parcel.status = "SEALED";
  parcel.sealedAt = at;
  return parcel;
}

function seedProgress(
  state: PackSessionState,
  task: TaskFacts,
  order: Order,
  codFor: (value: number) => number,
) {
  if (task.packStatus !== "ON_HOLD" && task.packStatus !== "PACKED") return;
  const at = task.packedAt ?? task.startedAt ?? new Date().toISOString();
  const parcel = sealedParcelWithEverything(state, at);
  if (task.packStatus !== "PACKED") return;
  const value = state.lines.reduce((sum, l) => sum + l.unitPrice * l.wanted, 0);
  const shipment: ShipmentState = {
    shipmentId: `${state.taskId}-shp-1`,
    code: `${order.orderNumber}-S1`,
    status: "READY_TO_DISPATCH",
    packageCount: 1,
    codAmount: codFor(value),
    value,
    partial: false,
    readyAt: at,
  };
  parcel.shipmentId = shipment.shipmentId;
  state.shipments.push(shipment);
}

/** COD của một lô theo BE `OrderService.codFor`: tiền đã trả trước đi vào các lô theo thứ tự tạo. */
export function codOf(order: Order, previous: readonly ShipmentState[], value: number): number {
  if (order.paymentMethodType !== "COD") return 0;
  const used = previous.reduce((sum, s) => sum + s.value, 0);
  return Math.max(0, value - Math.max(0, order.amountPaid - used));
}

export async function getPackSession(
  task: TaskFacts,
  order: Order,
  packerName: (userId: string) => Promise<string | undefined>,
): Promise<PackSessionState> {
  const existing = sessions.get(task.taskId);
  if (existing) return existing;
  const state: PackSessionState = {
    taskId: task.taskId,
    orderNumber: order.orderNumber,
    lines: order.lines.map(lineState),
    parcels: [],
    shipments: [],
    scans: new Map(),
  };
  if (task.packStatus !== "PENDING" && task.packStatus !== "CANCELLED") {
    state.packerId = task.assignedUserId;
    state.packerName = await packerName(task.assignedUserId);
    state.startedAt = task.startedAt ?? new Date().toISOString();
    state.packedAt = task.packedAt;
  }
  seedProgress(state, task, order, (value) => codOf(order, [], value));
  sessions.set(task.taskId, state);
  return state;
}
