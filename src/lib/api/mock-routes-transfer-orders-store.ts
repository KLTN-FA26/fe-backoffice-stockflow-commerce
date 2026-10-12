/**
 * Store in-memory cho mock lệnh chuyển kho (BE TransferOrderController, SCRUM-326/327), chỉ dùng
 * khi USE_MOCK=true. Record = `TransferOrderResponse` của BE; seed chép từ `transferOrders` của
 * mock-data (đổi status sang mã BE, lý do tự do → null vì BE chỉ nhận enum).
 */

import { MOCK_APPROVER, MOCK_SUBMITTER, beError } from "./mock-routes-purchase-orders-store";

export const MOCK_TRANSFER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PICKING",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;
export type MockTransferStatus = (typeof MOCK_TRANSFER_STATUSES)[number];

/** = BE `TransferStatus.canTransitionTo` (docs 10 §5). */
export const MOCK_TRANSFER_TRANSITIONS: Record<MockTransferStatus, readonly MockTransferStatus[]> =
  {
    DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "DRAFT"],
    APPROVED: ["PICKING", "CANCELLED"],
    PICKING: ["IN_TRANSIT", "APPROVED"],
    IN_TRANSIT: ["PARTIALLY_RECEIVED", "RECEIVED"],
    PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
    RECEIVED: ["COMPLETED"],
    COMPLETED: [],
    CLOSED: [],
    CANCELLED: [],
  };

/** BE `stockflow.inventory.transfer.approval-threshold-units` mặc định. */
export const MOCK_APPROVAL_THRESHOLD = 100;

export interface MockTransferLine {
  lineId: string;
  lineNo: number;
  sku: string;
  lotNumber: string | null;
  requested: number;
  shipped: number;
}

export interface MockTransfer {
  transferId: string;
  number: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: MockTransferStatus;
  reason: string | null;
  expectedDate: string | null;
  lines: MockTransferLine[];
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  version: number;
}

const STATUS_BY_MOCK_DATA: Record<string, MockTransferStatus> = {
  Draft: "DRAFT",
  "Pending Approval": "PENDING_APPROVAL",
  Approved: "APPROVED",
  Picking: "PICKING",
  "In Transit": "IN_TRANSIT",
  "Partially Received": "PARTIALLY_RECEIVED",
  Received: "RECEIVED",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

const PAST_DRAFT = new Set<MockTransferStatus>(["DRAFT", "CANCELLED"]);
const APPROVED_ONWARD = new Set<MockTransferStatus>([
  "APPROVED",
  "PICKING",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "COMPLETED",
]);

let store: Map<string, MockTransfer> | null = null;

export async function getTransferStore(): Promise<Map<string, MockTransfer>> {
  if (store) return store;
  const { transferOrders } = await import("@/lib/mock-data");
  store = new Map(
    transferOrders.map((to) => {
      const status = STATUS_BY_MOCK_DATA[to.status] ?? "DRAFT";
      const transfer: MockTransfer = {
        transferId: to.transferOrderId,
        number: to.toNumber,
        fromWarehouseId: to.fromWarehouseId,
        toWarehouseId: to.toWarehouseId,
        status,
        reason: null,
        expectedDate: null,
        lines: to.lines.map((line, index) => ({
          lineId: line.lineId,
          lineNo: index + 1,
          sku: line.skuId,
          lotNumber: line.lotId ?? null,
          requested: line.requestedQty,
          shipped: line.shippedQty,
        })),
        submittedBy: PAST_DRAFT.has(status) ? null : MOCK_SUBMITTER,
        submittedAt: PAST_DRAFT.has(status) ? null : to.createdAt,
        approvedBy: APPROVED_ONWARD.has(status) ? MOCK_APPROVER : null,
        approvedAt: APPROVED_ONWARD.has(status) ? to.createdAt : null,
        dispatchedBy: to.shippedAt ? MOCK_SUBMITTER : null,
        dispatchedAt: to.shippedAt ?? null,
        cancelReason: status === "CANCELLED" ? (to.notes ?? to.reason) : null,
        createdAt: to.createdAt,
        version: 0,
      };
      return [transfer.transferId, transfer];
    }),
  );
  return store;
}

export function resetTransferMockStore(): void {
  store = null;
}

const sequenceByDay = new Map<string, number>();
/** = BE TransferOrderRepositoryAdapter#nextNumber: `TO-yyyyMMdd-0001`, đếm theo ngày giờ VN. */
export function nextTransferNumber(): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    .format(new Date())
    .replaceAll("-", "");
  const next = (sequenceByDay.get(day) ?? 0) + 1;
  sequenceByDay.set(day, next);
  return `TO-${day}-${String(next).padStart(4, "0")}`;
}

export const transferNotFound = (id: string) =>
  beError(404, "TRANSFER_ORDER_NOT_FOUND", `Transfer order ${id} not found`);

export const invalidTransferTransition = (from: string, to: string) =>
  beError(409, "INVALID_TRANSFER_TRANSITION", `Transfer cannot move from ${from} to ${to}`);
