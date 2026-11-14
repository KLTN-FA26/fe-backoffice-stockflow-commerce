/**
 * Mock thanh toán theo hợp đồng — store in-memory cho `mock-routes-payment.ts` và
 * `mock-routes-refunds.ts` (BE payment module: đợt thanh toán, phiếu thu, hoàn tiền; docs 15).
 * Dữ liệu gắn vào các đơn có sẵn của mock-data (không thêm đơn mới). Đây là ASSUMPTION mock-only:
 * mock-data chưa có hợp đồng / đợt, nên lịch đợt dưới đây là dữ liệu minh hoạ cho từng trạng thái
 * của docs 15 §5.1 (kể cả kịch bản WF4 X03: đợt `BEFORE_DELIVERY` gắn đợt giao chưa trả → chặn bàn giao).
 */

import { mockCustomerUuid } from "./mock-routes-orders-store";

import type {
  InstallmentApiStatus,
  InstallmentMilestone,
  ReceiptApiStatus,
  RefundApiStatus,
  SettlementKind,
} from "@/constants/payment";

export interface MockInstallment {
  installmentId: string;
  contractId: string;
  contractNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  seq: number;
  name: string;
  milestone: InstallmentMilestone;
  deliveryBatchSeq: number | null;
  amount: number;
  paidAmount: number;
  reducedAmount: number;
  currency: string;
  dueDays: number | null;
  reachedAt: string | null;
  dueDate: string | null;
  cancelled: boolean;
}

export interface MockReceipt {
  receiptId: string;
  customerId: string;
  reference: string;
  receivedOn: string;
  amount: number;
  currency: string;
  note: string | null;
  status: ReceiptApiStatus;
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  lines: { installmentId: string; amount: number }[];
}

export interface MockRefundRecord {
  refundRecordId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  amount: number;
  currency: string;
  refundedOn: string;
  reference: string;
  note: string | null;
  status: ReceiptApiStatus;
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface MockSettlement {
  settlementId: string;
  kind: SettlementKind;
  collected: number;
  closed: number;
  reduced: number;
  surplus: number;
  fee: number;
  feePercent: number | null;
  feeReason: string | null;
  feeDetail: string | null;
  feeCovered: number;
  refundable: number;
  feeOwed: number;
  feeItemId: string | null;
  settledAt: string;
}

export interface MockOrderRefund {
  orderId: string;
  orderNumber: string;
  customerId: string;
  currency: string;
  settlements: MockSettlement[];
}

/** Ngày hôm nay theo giờ Việt Nam (`YYYY-MM-DD`). */
export const mockToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

/** Số còn phải thu của đợt: giá trị trừ phần đã giảm (đóng phần còn lại) trừ đã thu. */
export const outstandingOf = (i: MockInstallment) =>
  Math.max(0, i.amount - i.reducedAmount - i.paidAmount);

/**
 * docs 15 §5.1: trạng thái tính từ tiền và mốc. Quá hạn KHÔNG còn là trạng thái mà là cờ
 * (`overdueOf`, BE `Installment.overdue(today)` — WF-05 fix plan §8).
 */
export function statusOf(i: MockInstallment): InstallmentApiStatus {
  if (i.cancelled) return "CANCELLED";
  if (outstandingOf(i) === 0) return "PAID";
  if (i.paidAmount > 0) return "PARTIALLY_PAID";
  return i.reachedAt ? "DUE" : "NOT_DUE";
}

/** Đã qua hạn trả mà chưa trả đủ (BE `Installment.overdue(today)`). */
export function overdueOf(i: MockInstallment): boolean {
  const status = statusOf(i);
  return (
    (status === "DUE" || status === "PARTIALLY_PAID") &&
    i.reachedAt !== null &&
    i.dueDate !== null &&
    i.dueDate < mockToday()
  );
}

export const refundStatusOf = (refundable: number, refunded: number): RefundApiStatus =>
  refundable <= 0
    ? "NONE"
    : refunded <= 0
      ? "PENDING"
      : refunded < refundable
        ? "PARTIALLY_REFUNDED"
        : "REFUNDED";

let installments: MockInstallment[] = [];
let receipts: MockReceipt[] = [];
let refundRecords: MockRefundRecord[] = [];
let orderRefunds: MockOrderRefund[] = [];
let counter = 0;

export const nextMockPaymentId = (prefix: string) =>
  `${prefix}-${String(++counter).padStart(4, "0")}`;
export const mockInstallments = () => installments;
export const mockReceipts = () => receipts;
export const mockRefundRecords = () => refundRecords;
export const mockOrderRefunds = () => orderRefunds;

type Plan = [
  seq: number,
  name: string,
  milestone: InstallmentMilestone,
  amount: number,
  paid: number,
  opts?: { batch?: number; reached?: string; due?: string; days?: number; cancelled?: boolean },
];

function contract(
  orderId: string,
  mockCustomer: string,
  no: string,
  plan: Plan[],
): MockInstallment[] {
  return plan.map(([seq, name, milestone, amount, paid, o = {}]) => ({
    installmentId: `INST-${orderId}-${seq}`,
    contractId: `CON-${orderId}`,
    contractNumber: `HD-20261108-${no}`,
    orderId,
    orderNumber: orderId,
    customerId: mockCustomerUuid(mockCustomer),
    seq,
    name,
    milestone,
    deliveryBatchSeq: o.batch ?? null,
    amount,
    paidAmount: paid,
    reducedAmount: 0,
    currency: "VND",
    dueDays: o.days ?? null,
    reachedAt: o.reached ?? null,
    dueDate: o.due ?? null,
    cancelled: o.cancelled ?? false,
  }));
}

const receipt = (
  reference: string,
  mockCustomer: string,
  receivedOn: string,
  lines: [string, number][],
  extra: Partial<MockReceipt> = {},
): MockReceipt => ({
  receiptId: nextMockPaymentId("RCP"),
  customerId: mockCustomerUuid(mockCustomer),
  reference,
  receivedOn,
  amount: lines.reduce((sum, [, amount]) => sum + amount, 0),
  currency: "VND",
  note: null,
  status: "RECORDED",
  recordedAt: `${receivedOn}T03:00:00Z`,
  voidedAt: null,
  voidReason: null,
  lines: lines.map(([installmentId, amount]) => ({ installmentId, amount })),
  ...extra,
});

export function resetPaymentMockStore(): void {
  counter = 0;
  installments = [
    ...contract("ORD-2026-0014", "CUS-0012", "000014-1", [
      [
        1,
        "Đặt cọc 30%",
        "ON_SIGNING",
        30_000_000,
        0,
        { reached: "2026-11-08T02:00:00Z", due: "2026-11-15", days: 7 },
      ],
      [2, "Thanh toán trước khi giao", "BEFORE_DELIVERY", 40_000_000, 0],
      [3, "Còn lại sau giao 30 ngày", "AFTER_DELIVERY", 30_000_000, 0, { days: 30 }],
    ]),
    ...contract("ORD-2026-0013", "CUS-0009", "000013-1", [
      [
        1,
        "Đặt cọc",
        "ON_SIGNING",
        20_000_000,
        20_000_000,
        { reached: "2026-11-05T02:00:00Z", due: "2026-11-12", days: 7 },
      ],
      [
        2,
        "Trả trước khi nhận đợt giao 1",
        "BEFORE_DELIVERY",
        25_000_000,
        0,
        { batch: 1, reached: "2026-11-11T02:00:00Z" },
      ],
      [3, "Trả trước khi nhận đợt giao 2", "BEFORE_DELIVERY", 25_000_000, 0, { batch: 2 }],
      [4, "Còn lại sau giao 30 ngày", "AFTER_DELIVERY", 30_000_000, 0, { days: 30 }],
    ]),
    ...contract("ORD-2026-0010", "CUS-0008", "000010-1", [
      [
        1,
        "Đặt cọc",
        "ON_SIGNING",
        15_000_000,
        15_000_000,
        { reached: "2026-11-01T02:00:00Z", due: "2026-11-08", days: 7 },
      ],
      [
        2,
        "Thanh toán trước khi giao",
        "BEFORE_DELIVERY",
        15_000_000,
        5_000_000,
        { reached: "2026-11-10T02:00:00Z" },
      ],
      [3, "Còn lại sau giao 15 ngày", "AFTER_DELIVERY", 20_000_000, 0, { days: 15 }],
    ]),
    ...contract("ORD-2026-0016", "CUS-0007", "000016-1", [
      [
        1,
        "Đặt cọc",
        "ON_SIGNING",
        10_000_000,
        10_000_000,
        { reached: "2026-10-01T02:00:00Z", due: "2026-10-08", days: 7 },
      ],
      [
        2,
        "Còn lại sau giao 15 ngày",
        "AFTER_DELIVERY",
        40_000_000,
        10_000_000,
        { reached: "2026-10-15T02:00:00Z", due: "2026-10-30", days: 15 },
      ],
    ]),
    ...contract("ORD-2026-0015", "CUS-0004", "000015-1", [
      [
        1,
        "Đặt cọc",
        "ON_SIGNING",
        12_000_000,
        12_000_000,
        { reached: "2026-10-20T02:00:00Z", due: "2026-10-27", days: 7 },
      ],
      [2, "Còn lại", "AFTER_DELIVERY", 28_000_000, 0, { days: 30, cancelled: true }],
    ]),
  ];
  receipts = [
    receipt("FT26313123456", "CUS-0009", "2026-11-05", [["INST-ORD-2026-0013-1", 20_000_000]]),
    receipt("FT26313000111", "CUS-0008", "2026-11-10", [
      ["INST-ORD-2026-0010-1", 15_000_000],
      ["INST-ORD-2026-0010-2", 5_000_000],
    ]),
    receipt("FT26312000222", "CUS-0007", "2026-10-02", [["INST-ORD-2026-0016-1", 10_000_000]]),
    receipt("FT26312000333", "CUS-0007", "2026-10-20", [["INST-ORD-2026-0016-2", 10_000_000]]),
    receipt("FT26311999333", "CUS-0012", "2026-11-09", [["INST-ORD-2026-0014-1", 30_000_000]], {
      status: "VOIDED",
      voidedAt: "2026-11-09T09:00:00Z",
      voidReason: "Nhầm khách: tiền thuộc về khách khác",
    }),
    receipt("FT26310111444", "CUS-0004", "2026-10-20", [["INST-ORD-2026-0015-1", 12_000_000]]),
  ];
  refundRecords = [];
  orderRefunds = [
    {
      orderId: "ORD-2026-0015",
      orderNumber: "ORD-2026-0015",
      customerId: mockCustomerUuid("CUS-0004"),
      currency: "VND",
      settlements: [
        {
          settlementId: "STL-ORD-2026-0015",
          kind: "ORDER_CANCELLED",
          collected: 12_000_000,
          closed: 0,
          reduced: 28_000_000,
          surplus: 12_000_000,
          fee: 0,
          feePercent: null,
          feeReason: null,
          feeDetail: null,
          feeCovered: 0,
          refundable: 12_000_000,
          feeOwed: 0,
          feeItemId: null,
          settledAt: "2026-10-25T04:00:00Z",
        },
      ],
    },
  ];
}

resetPaymentMockStore();
