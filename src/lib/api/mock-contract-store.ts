/**
 * Hợp đồng mua bán của đơn (WF-02 pha B) — store in-memory + hình `SalesContracts.ContractView` của BE (origin/develop).
 * Seed: `HD-20261120-900001-1` ĐÃ GỬI cho `SO-20261120-900001` (V20261124000600 §7) và `HD-20261202-900002-1` NHÁP cho
 * `SO-20261202-900002` của khách đang có khoản quá hạn (V20261203000100 §3). Tín dụng (15 BR-10, BR-11): hạn mức + dư nợ
 * seed của khách, cộng phần trả sau giao chưa trả của các hợp đồng ký trong phiên (mock thanh toán).
 */

import {
  WF02_SEED_ORDER_LINES,
  WF02_SEED_ORDERS,
  findWf02Order,
  orderNet,
  orderTax,
  orderTotal,
} from "./mock-contract-orders";
import { batchValues } from "./mock-contract-terms";
import { percentOf } from "./mock-quote-money";
import {
  WF02_SELLER,
  addDays,
  instantFromNow,
  vnDay,
  wf02Customer,
  WF02_USERS,
} from "./mock-quote-seed";
import { mockInstallments, outstandingOf, overdueOf } from "./mock-payment-store";

import type { SalesContractStatus } from "@/constants";
import type { Wf02Order } from "./mock-contract-orders";
import type { MockBatch, MockPlannedInstallment } from "./mock-contract-terms";
import type { Wf02Party } from "./mock-quote-seed";

export interface MockContract {
  id: string;
  contractNumber: string;
  orderId: string;
  status: SalesContractStatus;
  seller: Wf02Party;
  buyer: Wf02Party;
  freeSampleRounds: number;
  returnWindowDays: number | null;
  schedule: MockBatch[];
  plan: MockPlannedInstallment[];
  sentAt: string | null;
  sentBy: string | null;
  sentDocumentKey: string | null;
  signedOn: string | null;
  signedFileName: string | null;
  signedFileKey: string | null;
  signedAt: string | null;
  signedBy: string | null;
  /** Idempotency-Key của lần ghi nhận ký — gửi lại cùng key → trả lại hợp đồng đã ký. */
  signedWithKey: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
}

/** Mặc định BE: 2 lần in mẫu (`CONTRACT_FREE_SAMPLE_ROUNDS`), khiếu nại 7 ngày (`ReturnPolicy`). */
export const DEFAULT_FREE_SAMPLE_ROUNDS = 2;
export const DEFAULT_RETURN_WINDOW_DAYS = 7;

const SEED_PLAN_NAMES = {
  deposit: "Đặt cọc khi ký",
  before: "Thanh toán trước giao đợt 1",
  after: "Thanh toán sau giao đợt 2",
} as const;

function seedContract(
  id: string,
  contractNumber: string,
  order: Wf02Order | undefined,
  lineId: string,
  plan: (total: number) => MockPlannedInstallment[],
): MockContract | null {
  const buyer = order ? wf02Customer(order.customerId)?.buyer : undefined;
  if (!order || !buyer) return null;
  const today = vnDay();
  return {
    id,
    contractNumber,
    orderId: order.orderId,
    status: "DRAFT",
    seller: WF02_SELLER,
    buyer,
    freeSampleRounds: DEFAULT_FREE_SAMPLE_ROUNDS,
    returnWindowDays: null,
    schedule: [
      {
        seq: 1,
        windowStart: addDays(today, 21),
        windowEnd: addDays(today, 23),
        lines: [{ orderLineId: lineId, cartons: 30 }],
      },
      {
        seq: 2,
        windowStart: addDays(today, 35),
        windowEnd: addDays(today, 37),
        lines: [{ orderLineId: lineId, cartons: 30 }],
      },
    ],
    plan: plan(orderTotal(order)),
    sentAt: null,
    sentBy: null,
    sentDocumentKey: null,
    signedOn: null,
    signedFileName: null,
    signedFileKey: null,
    signedAt: null,
    signedBy: null,
    signedWithKey: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    completedAt: null,
    version: 0,
    createdAt: instantFromNow(-3 * 24),
  };
}

function seed(): MockContract[] {
  // V20261124000600 §7: 77.550.000 = cọc 30% 23.265.000 + trước giao đợt 1 27.142.500 + sau giao đợt 2 (30 ngày) 27.142.500
  const demo = seedContract(
    "63f3ad57-98ab-c65e-aea2-f3f6bbd589fb",
    "HD-20261120-900001-1",
    findWf02Order(WF02_SEED_ORDERS.demo.orderId),
    WF02_SEED_ORDER_LINES.demo,
    () => [
      {
        seq: 1,
        name: SEED_PLAN_NAMES.deposit,
        milestone: "ON_SIGNING",
        percent: 30,
        amount: 23_265_000,
        dueDays: 3,
        deliveryBatchSeq: null,
      },
      {
        seq: 2,
        name: SEED_PLAN_NAMES.before,
        milestone: "BEFORE_DELIVERY",
        percent: null,
        amount: 27_142_500,
        dueDays: null,
        deliveryBatchSeq: 1,
      },
      {
        seq: 3,
        name: SEED_PLAN_NAMES.after,
        milestone: "AFTER_DELIVERY",
        percent: null,
        amount: 27_142_500,
        dueDays: 30,
        deliveryBatchSeq: 2,
      },
    ],
  );
  if (demo)
    Object.assign(demo, {
      status: "SENT",
      sentAt: instantFromNow(-2 * 24),
      sentBy: WF02_USERS.sales,
      sentDocumentKey: "documents/demo/HD-20261120-900001-1.pdf",
      version: 1,
    });
  // V20261203000100 §3: cọc 30% (làm tròn), phần còn lại chia đôi — trước giao đợt 1 lấy phần sàn, sau giao đợt 2 (15 ngày)
  const tsm = seedContract(
    "863cc69b-1bf9-83ec-828d-9d6cab9a565f",
    "HD-20261202-900002-1",
    findWf02Order(WF02_SEED_ORDERS.tsm.orderId),
    WF02_SEED_ORDER_LINES.tsm,
    (total) => {
      const deposit = percentOf(total, 30);
      const before = Math.floor((total - deposit) / 2);
      return [
        {
          seq: 1,
          name: SEED_PLAN_NAMES.deposit,
          milestone: "ON_SIGNING",
          percent: 30,
          amount: deposit,
          dueDays: 3,
          deliveryBatchSeq: null,
        },
        {
          seq: 2,
          name: SEED_PLAN_NAMES.before,
          milestone: "BEFORE_DELIVERY",
          percent: null,
          amount: before,
          dueDays: null,
          deliveryBatchSeq: 1,
        },
        {
          seq: 3,
          name: SEED_PLAN_NAMES.after,
          milestone: "AFTER_DELIVERY",
          percent: null,
          amount: total - deposit - before,
          dueDays: 15,
          deliveryBatchSeq: 2,
        },
      ];
    },
  );
  if (tsm)
    Object.assign(tsm, {
      returnWindowDays: DEFAULT_RETURN_WINDOW_DAYS,
      createdAt: instantFromNow(-20),
    });
  return [demo, tsm].filter((c): c is MockContract => c !== null);
}

let contracts: MockContract[] | null = null;
export const mockContracts = (): MockContract[] => (contracts ??= seed());

export function resetContractMockStore(): void {
  contracts = null;
}

/** Hợp đồng còn hiệu lực của đơn (BE `findLiveByOrderId`: mọi trạng thái trừ CANCELLED). */
export const liveContractOf = (orderId: string) =>
  mockContracts().find((c) => c.orderId === orderId && c.status !== "CANCELLED");

/* ── Tín dụng (15 BR-10, BR-11, BR-12) ───────────────────────────────── */

export interface CreditCheck {
  outcome: "WITHIN_LIMIT" | "OVERDUE" | "OVER_LIMIT";
  creditLimit: number;
  exposure: number;
  afterDelivery: number;
}

export const creditTermsOf = (customerId: string) => wf02Customer(customerId)?.credit ?? null;

/** BE `creditApproved`: hạn mức > 0 do kế toán duyệt. */
export const creditApproved = (customerId: string) =>
  (creditTermsOf(customerId)?.creditLimit ?? 0) > 0;

/** BE `creditCheck`: phần trả sau giao của hợp đồng so với dư nợ + quá hạn của khách; null khi không có phần đó. */
export function creditCheckOf(order: Wf02Order, contract: MockContract): CreditCheck | null {
  const afterDelivery = contract.plan
    .filter((i) => i.milestone === "AFTER_DELIVERY")
    .reduce((sum, i) => sum + i.amount, 0);
  if (afterDelivery === 0) return null;
  const terms = creditTermsOf(order.customerId);
  // Đợt sau giao của các hợp đồng ký trong phiên (mock thanh toán), cộng dư nợ seed
  const opened = mockInstallments().filter(
    (i) => i.customerId === order.customerId && i.milestone === "AFTER_DELIVERY" && !i.cancelled,
  );
  const exposure = (terms?.exposure ?? 0) + opened.reduce((sum, i) => sum + outstandingOf(i), 0);
  const creditLimit = terms?.creditLimit ?? 0;
  const outcome =
    terms?.hasOverdue || opened.some(overdueOf)
      ? "OVERDUE"
      : exposure + afterDelivery > creditLimit
        ? "OVER_LIMIT"
        : "WITHIN_LIMIT";
  return { outcome, creditLimit, exposure, afterDelivery };
}

/** BE `creditWarning`: chỉ khi kiểm không đạt — cảnh báo, không chặn. */
export function creditWarningOf(order: Wf02Order, contract: MockContract) {
  const check = creditCheckOf(order, contract);
  return check && check.outcome !== "WITHIN_LIMIT"
    ? {
        outcome: check.outcome,
        creditLimit: check.creditLimit,
        exposure: check.exposure,
        afterDelivery: check.afterDelivery,
      }
    : null;
}

/* ── Response (BE `ContractView`) ────────────────────────────────────── */

export const installmentView = (i: MockPlannedInstallment) => ({
  seq: i.seq,
  name: i.name,
  milestone: i.milestone,
  percent: i.percent,
  amount: i.amount,
  dueDays: i.dueDays,
  deliveryBatchSeq: i.deliveryBatchSeq,
});

/**
 * @param warning cảnh báo tín dụng: GET / lập / sửa trả cảnh báo của bản NHÁP (14 §4.3 bước 13), gửi trả cảnh báo lúc
 *                gửi; lịch sử và các bước khác không có
 */
export function contractView(
  contract: MockContract,
  order: Wf02Order,
  warning: ReturnType<typeof creditWarningOf> = null,
) {
  const values = batchValues(order, contract.schedule);
  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    orderId: contract.orderId,
    orderNumber: order.orderNumber,
    status: contract.status,
    seller: contract.seller,
    buyer: contract.buyer,
    freeSampleRounds: contract.freeSampleRounds,
    totals: {
      netAmount: orderNet(order),
      taxAmount: orderTax(order),
      totalAmount: orderTotal(order),
      currency: "VND",
    },
    deliverySchedule: contract.schedule.map((batch) => ({
      seq: batch.seq,
      windowStart: batch.windowStart,
      windowEnd: batch.windowEnd,
      value: values.get(batch.seq) ?? 0,
      lines: batch.lines.map((line) => {
        const orderLine = order.lines.find((l) => l.lineId === line.orderLineId);
        return {
          orderLineId: line.orderLineId,
          sku: orderLine?.sku ?? null,
          cartons: line.cartons,
          units: orderLine ? line.cartons * orderLine.unitsPerCarton : 0,
        };
      }),
    })),
    paymentPlan: contract.plan.map(installmentView),
    sentAt: contract.sentAt,
    sentBy: contract.sentBy,
    signedOn: contract.signedOn,
    signedFileName: contract.signedFileName,
    signedAt: contract.signedAt,
    signedBy: contract.signedBy,
    cancelledAt: contract.cancelledAt,
    cancelledBy: contract.cancelledBy,
    cancellationReason: contract.cancellationReason,
    completedAt: contract.completedAt,
    version: contract.version,
    creditWarning: warning,
    returnWindowDays: contract.returnWindowDays,
  };
}
