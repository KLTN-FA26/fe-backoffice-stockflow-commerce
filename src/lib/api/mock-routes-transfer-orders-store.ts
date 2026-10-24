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
  /** BE PR #164 (LP2-8): FULL_TRUCKLOAD (mặc định) hoặc PARCEL (xuất kho thủ công). */
  deliveryMode: "PARCEL" | "FULL_TRUCKLOAD";
  /** Đóng gói xong (hoàn tất phiên `transfer-packs`). */
  packedAt: string | null;
  /** Xe đầu tiên đã ký nhận: từ đây không dừng lấy hàng nữa (docs 10 BR-04). */
  goodsLeftAt: string | null;
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
        deliveryMode: "FULL_TRUCKLOAD",
        packedAt: PACKED_SEEDS.has(to.transferOrderId) ? to.createdAt : null,
        goodsLeftAt: null,
      };
      return [transfer.transferId, transfer];
    }),
  );
  for (const extra of extraSeeds()) store.set(extra.transferId, extra);
  return store;
}

/** Lệnh seed của mock-data đã đóng gói xong (PICKING nguyên chuyến) — để thử lập kế hoạch xe ngay. */
const PACKED_SEEDS: ReadonlySet<string> = new Set(["TO-2026-0006"]);

/** Id lệnh seed thêm cho demo đóng gói chuyển kho (không có trong mock-data, nên không đụng `mock-data.ts`). */
export const MOCK_TRANSFER_KIT_ID = "00000000-0000-4000-8000-0000000fa001";
export const MOCK_TRANSFER_PARCEL_ID = "00000000-0000-4000-8000-0000000fa002";
const HN = "WH-HN-01";
const HCM = "WH-HCM-01";

/**
 * Hai lệnh bổ sung: (1) Đã duyệt nguyên chuyến, có một bộ đi 2 thùng và hai lô cùng SKU — để thử đóng bộ, chọn dòng
 * khi quét và giao nguyên thùng; (2) Đang lấy hàng giao lẻ — còn xuất kho thủ công.
 */
function extraSeeds(): MockTransfer[] {
  const base = {
    reason: null,
    expectedDate: null,
    submittedBy: MOCK_SUBMITTER,
    submittedAt: "2026-10-22T01:00:00Z",
    approvedBy: MOCK_APPROVER,
    approvedAt: "2026-10-22T01:30:00Z",
    dispatchedBy: null,
    dispatchedAt: null,
    cancelReason: null,
    createdAt: "2026-10-22T00:30:00Z",
    version: 0,
    packedAt: null,
    goodsLeftAt: null,
  } as const;
  return [
    {
      ...base,
      transferId: MOCK_TRANSFER_KIT_ID,
      number: "TO-20261022-0001",
      fromWarehouseId: HN,
      toWarehouseId: HCM,
      status: "APPROVED",
      deliveryMode: "FULL_TRUCKLOAD",
      lines: [
        {
          lineId: "tol-kit-1",
          lineNo: 1,
          sku: "SKU-KIT-DESK",
          lotNumber: null,
          requested: 2,
          shipped: 0,
        },
        {
          lineId: "tol-kit-2",
          lineNo: 2,
          sku: "SKU-001-BLK-L",
          lotNumber: "LOT-2610-A",
          requested: 10,
          shipped: 0,
        },
        {
          lineId: "tol-kit-3",
          lineNo: 3,
          sku: "SKU-001-BLK-L",
          lotNumber: "LOT-2610-B",
          requested: 10,
          shipped: 0,
        },
      ],
    },
    {
      ...base,
      transferId: MOCK_TRANSFER_PARCEL_ID,
      number: "TO-20261022-0002",
      fromWarehouseId: HCM,
      toWarehouseId: HN,
      status: "PICKING",
      deliveryMode: "PARCEL",
      lines: [
        {
          lineId: "tol-par-1",
          lineNo: 1,
          sku: "SKU-002-WHT",
          lotNumber: null,
          requested: 30,
          shipped: 0,
        },
      ],
    },
  ];
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
