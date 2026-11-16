/**
 * Mock trả hàng — store in-memory cho `mock-routes-returns.ts` và `mock-routes-return-receipts.ts` (BE
 * `ReturnRequestController`, `ReturnResolutionController`, `ReturnReceiptController`; docs 17 §4.10, 03 §4.2).
 * Gắn vào các đơn đã giao có sẵn của mock-data (không thêm đơn). ASSUMPTION mock-only: mock-data chưa có RMA nên các
 * yêu cầu dưới đây minh hoạ từng trạng thái của BE `ReturnStatus` (đủ badge và action-gating để demo).
 */

import { mockCustomerUuid } from "./mock-routes-orders-store";

import type { ReturnApiStatus, ReturnReason, ReturnReceiptApiStatus } from "@/constants/returns";

export interface MockReturnLine {
  id: string;
  orderLineId: string;
  sku: string;
  customPrinted: boolean;
  unitPrice: number;
  requestedQuantity: number;
  approvedQuantity: number | null;
  receivedQuantity: number | null;
  refundQuantity: number;
  refundAmount: number | null;
}

export interface MockReturn {
  id: string;
  rmaNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  warehouseId: string;
  status: ReturnApiStatus;
  reasonCode: ReturnReason;
  description: string | null;
  channel: "PORTAL" | "BACK_OFFICE";
  requestedBy: string;
  requestedAt: string;
  lateClaimReason: string | null;
  currency: string;
  review: Record<string, unknown> | null;
  receipt: Record<string, unknown> | null;
  resolution: Record<string, unknown> | null;
  cancellationReason: string | null;
  closedAt: string | null;
  lines: MockReturnLine[];
  evidence: { id: string; stage: string; originalName: string; uploadedAt: string }[];
  history: { from: string | null; to: string; reason: string | null; occurredAt: string }[];
  version: number;
}

export interface MockReturnReceipt {
  id: string;
  number: string;
  status: ReturnReceiptApiStatus;
  warehouseId: string;
  orderId: string;
  orderNumber: string;
  shipmentId: string | null;
  shipmentCode: string | null;
  returnRequestId: string | null;
  rmaNumber: string | null;
  quarantineLocationCode: string;
  note: string | null;
  receivedAt: string;
  closedAt: string | null;
  cartons: {
    lpn: string;
    sku: string;
    lotNumber: string;
    quantity: number;
    condition: string | null;
    scannedAt: string;
  }[];
  /** Thùng của nguồn (shipment / đơn) — ASSUMPTION mock: LPN sinh theo dòng đơn. */
  source: { lpn: string; sku: string; lotNumber: string; quantity: number }[];
  version: number;
}

/** Kho mock của các đơn (mock-data `WH-HCM-01`). */
export const MOCK_RETURN_WAREHOUSE = "WH-HCM-01";
/** Người dùng mock khác người đang đăng nhập — để bốn mắt (`RETURN_SELF_APPROVAL`) không chặn khi demo. */
const SALES = "mock-sales-staff";

let returns: MockReturn[] = [];
let receipts: MockReturnReceipt[] = [];
let counter = 0;

export const nextMockReturnId = (prefix: string) =>
  `${prefix}-${String(++counter).padStart(4, "0")}`;
export const mockReturns = () => returns;
export const mockReturnReceipts = () => receipts;

const line = (
  orderLineId: string,
  sku: string,
  unitPrice: number,
  requested: number,
  extra: Partial<MockReturnLine> = {},
): MockReturnLine => ({
  id: `RL-${orderLineId}`,
  orderLineId,
  sku,
  customPrinted: false,
  unitPrice,
  requestedQuantity: requested,
  approvedQuantity: null,
  receivedQuantity: null,
  refundQuantity: 0,
  refundAmount: null,
  ...extra,
});

function seed(
  id: string,
  status: ReturnApiStatus,
  order: [orderId: string, mockCustomer: string],
  lines: MockReturnLine[],
  extra: Partial<MockReturn> = {},
): MockReturn {
  return {
    id,
    rmaNumber: `RMA-20261110-${id.slice(-4)}`,
    orderId: order[0],
    orderNumber: order[0],
    customerId: mockCustomerUuid(order[1]),
    warehouseId: MOCK_RETURN_WAREHOUSE,
    status,
    reasonCode: "PRINT_DEFECT",
    description: "Hình in bị lem ở mặt trước.",
    channel: "PORTAL",
    requestedBy: "mock-customer",
    requestedAt: "2026-11-10T03:00:00Z",
    lateClaimReason: null,
    currency: "VND",
    review: null,
    receipt: null,
    resolution: null,
    cancellationReason: null,
    closedAt: null,
    lines,
    evidence: [
      {
        id: `EV-${id}`,
        stage: "CLAIM",
        originalName: "anh-loi-in.jpg",
        uploadedAt: "2026-11-10T03:01:00Z",
      },
    ],
    history: [
      { from: null, to: "REQUESTED", reason: "PRINT_DEFECT", occurredAt: "2026-11-10T03:00:00Z" },
    ],
    version: 0,
    ...extra,
  };
}

const reviewed = (deadline = "2026-11-25T17:00:00Z") => ({
  decidedBy: SALES,
  decidedAt: "2026-11-11T02:00:00Z",
  note: null,
  returnRequired: true,
  returnDeadline: deadline,
});

export function resetReturnMockStore(): void {
  counter = 0;
  const o16: [string, string] = ["ORD-2026-0016", "CUS-0007"];
  const o4: [string, string] = ["ORD-2026-0004", "CUS-0002"];
  const o2: [string, string] = ["ORD-2026-0002", "CUS-0001"];
  const o19: [string, string] = ["ORD-2026-0019", "CUS-0005"];
  returns = [
    seed("RMA-0001", "REQUESTED", o4, [line("ORDL-0004-1", "SKU-001-BLK-M", 149_000, 2)]),
    seed(
      "RMA-0002",
      "AWAITING_RETURN",
      o16,
      [line("ORDL-0016-1", "SKU-002-WHT", 89_000, 1, { approvedQuantity: 1 })],
      {
        reasonCode: "DAMAGED_IN_TRANSIT",
        description: "Thùng bị móp, hàng bên trong vỡ.",
        review: reviewed(),
      },
    ),
    seed(
      "RMA-0003",
      "RECEIVED",
      o19,
      [
        line("ORDL-0019-1", "SKU-001-BLK-M", 149_000, 2, {
          approvedQuantity: 2,
          receivedQuantity: 2,
        }),
      ],
      {
        channel: "BACK_OFFICE",
        requestedBy: SALES,
        review: reviewed(),
        receipt: {
          receivedAt: "2026-11-13T04:00:00Z",
          locationCode: "WH-HCM-01-QUARANTINE",
          goodsReceiptId: "RRC-SEED-1",
        },
      },
    ),
    seed(
      "RMA-0004",
      "SETTLEMENT_PENDING",
      o2,
      [
        line("ORDL-0002-1", "SKU-001-BLK-L", 149_000, 1, {
          approvedQuantity: 1,
          receivedQuantity: 1,
          refundQuantity: 1,
          refundAmount: 160_920,
        }),
      ],
      {
        review: reviewed(),
        receipt: { receivedAt: "2026-11-12T04:00:00Z", locationCode: "WH-HCM-01-QUARANTINE" },
        resolution: {
          moneyMode: "REFUND",
          settlementAmount: 160_920,
          proposedBy: SALES,
          proposedAt: "2026-11-13T05:00:00Z",
          vatAdjustmentRequired: true,
        },
      },
    ),
    seed(
      "RMA-0005",
      "RESOLVED",
      o2,
      [
        line("ORDL-0002-1", "SKU-001-BLK-L", 149_000, 1, {
          approvedQuantity: 1,
          receivedQuantity: 1,
          refundQuantity: 1,
          refundAmount: 160_920,
        }),
      ],
      {
        requestedAt: "2026-10-20T03:00:00Z",
        review: reviewed("2026-11-04T17:00:00Z"),
        receipt: { receivedAt: "2026-10-24T04:00:00Z", locationCode: "WH-HCM-01-QUARANTINE" },
        resolution: {
          moneyMode: "REFUND",
          settlementAmount: 160_920,
          proposedBy: SALES,
          proposedAt: "2026-10-25T05:00:00Z",
          settledBy: "mock-accountant",
          settledAt: "2026-10-26T05:00:00Z",
          offsetAmount: 0,
          refundedAmount: 160_920,
          vatAdjustmentRequired: true,
        },
        closedAt: "2026-10-26T05:00:00Z",
      },
    ),
    seed("RMA-0006", "REJECTED", o16, [line("ORDL-0016-1", "SKU-002-WHT", 89_000, 1)], {
      reasonCode: "OTHER",
      description: "Màu không giống ảnh.",
      review: {
        ...reviewed(),
        rejectionReason: "Màu đúng mẫu đã duyệt; sai lệch nằm trong dung sai in.",
      },
      closedAt: "2026-11-11T02:00:00Z",
    }),
    seed("RMA-0007", "CANCELLED", o4, [line("ORDL-0004-1", "SKU-001-BLK-M", 149_000, 1)], {
      requestedAt: "2026-11-08T03:00:00Z",
      cancellationReason: "Khách tự rút.",
      closedAt: "2026-11-09T03:00:00Z",
    }),
    seed(
      "RMA-0008",
      "EXPIRED",
      o19,
      [line("ORDL-0019-1", "SKU-001-BLK-M", 149_000, 1, { approvedQuantity: 1 })],
      {
        requestedAt: "2026-10-01T03:00:00Z",
        review: reviewed("2026-10-15T17:00:00Z"),
        closedAt: "2026-10-16T00:00:00Z",
      },
    ),
  ];
  receipts = [];
  counter = returns.length;
}

resetReturnMockStore();

/** Thùng mock của một đơn: một thùng cho mỗi dòng của các yêu cầu (đủ để quét demo). */
export function sourceCartonsOf(ret: MockReturn) {
  return ret.lines.map((l, i) => ({
    lpn: `LPN-${ret.orderId.slice(-4)}-${i + 1}`,
    sku: l.sku,
    lotNumber: "LOT-2026-10",
    quantity: l.approvedQuantity ?? l.requestedQuantity,
  }));
}
