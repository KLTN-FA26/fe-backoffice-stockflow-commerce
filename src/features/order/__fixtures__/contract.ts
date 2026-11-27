/**
 * Hợp đồng đúng hình JSON BE `ContractView` cho seed demo `HD-20261120-900001-1` (BE origin/develop 438fe6fb,
 * `db/demo/V20261124000600__demo_wf02.sql` §6–7): đơn SO-20261120-900001 60 thùng, 2 đợt giao 30 + 30,
 * 3 đợt thanh toán (cọc 30% khi ký / trước giao đợt 1 / sau giao 30 ngày đợt 2) cộng đủ 77.550.000 đ.
 * Trường null bị BỎ như Jackson `non_null`.
 */

import { apiOrder } from "./order";

import type { OrderDto } from "../types";

export const CONTRACT_ORDER_ID = "8a1b2c3d-4e5f-4061-8728-394a5b6c7d8e";
export const CONTRACT_LINE_ID = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";

export const contractOrderDto: OrderDto = {
  ...apiOrder,
  orderId: CONTRACT_ORDER_ID,
  orderNumber: "SO-20261120-900001",
  status: "DRAFT",
  totalAmount: 77_550_000,
  lines: [
    {
      lineId: CONTRACT_LINE_ID,
      sku: "LY-GIAY-DEMO-12OZ-XANH",
      quantity: 60_000,
      unitPrice: 1150,
      lineTotal: 69_000_000,
      reservationIds: [],
      shippedQuantity: 0,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
      cartons: 60,
      unitsPerCarton: 1000,
    },
  ],
};

const party = (name: string) => ({ name, taxCode: "0399990001", address: "12 Nguyễn Huệ" });

export const contractDraft = {
  id: "c1c1c1c1-0000-4000-8000-000000000001",
  contractNumber: "HD-20261120-900001-1",
  orderId: CONTRACT_ORDER_ID,
  orderNumber: "SO-20261120-900001",
  status: "DRAFT",
  seller: party("DEMO STOCKFLOW CO LTD"),
  buyer: party("Khách hàng demo"),
  freeSampleRounds: 2,
  totals: { netAmount: 70_500_000, taxAmount: 7_050_000, totalAmount: 77_550_000, currency: "VND" },
  deliverySchedule: [
    {
      seq: 1,
      windowStart: "2099-12-09",
      windowEnd: "2099-12-11",
      value: 38_775_000,
      lines: [
        {
          orderLineId: CONTRACT_LINE_ID,
          sku: "LY-GIAY-DEMO-12OZ-XANH",
          cartons: 30,
          units: 30_000,
        },
      ],
    },
    {
      seq: 2,
      windowStart: "2099-12-23",
      windowEnd: "2099-12-25",
      value: 38_775_000,
      lines: [
        {
          orderLineId: CONTRACT_LINE_ID,
          sku: "LY-GIAY-DEMO-12OZ-XANH",
          cartons: 30,
          units: 30_000,
        },
      ],
    },
  ],
  paymentPlan: [
    {
      seq: 1,
      name: "Đặt cọc khi ký",
      milestone: "ON_SIGNING",
      percent: 30,
      amount: 23_265_000,
      dueDays: 3,
    },
    {
      seq: 2,
      name: "Thanh toán trước giao đợt 1",
      milestone: "BEFORE_DELIVERY",
      amount: 27_142_500,
      deliveryBatchSeq: 1,
    },
    {
      seq: 3,
      name: "Thanh toán sau giao đợt 2",
      milestone: "AFTER_DELIVERY",
      amount: 27_142_500,
      dueDays: 30,
      deliveryBatchSeq: 2,
    },
  ],
  version: 0,
  returnWindowDays: 7,
};

export const contractSent = {
  ...contractDraft,
  status: "SENT",
  sentAt: "2026-11-16T03:00:00Z",
  sentBy: "a1a1a1a1-0000-4000-8000-000000000005",
  version: 1,
};

/** DS-02b: khách quá hạn — BE gắn cảnh báo vào bản nháp. */
/** 15 BR-11 (BE PR #486): Sale bấm Gửi, kiểm tín dụng OVER_LIMIT → vẫn DRAFT, chờ Kế toán duyệt. */
const pendingReview = {
  id: "77777777-0000-4000-8000-000000000001",
  outcome: "PENDING",
  checkOutcome: "OVER_LIMIT",
  creditLimit: 300_000_000,
  exposure: 290_000_000,
  afterDelivery: 27_142_500,
  overdueAmount: 0,
  contractVersion: 1,
  submittedAt: "2026-11-26T03:00:00Z",
  submittedBy: "11111111-0000-4000-8000-000000000009",
};

export const contractDraftPendingReview = {
  ...contractDraft,
  version: 1,
  creditReview: "PENDING",
  latestCreditReview: pendingReview,
};

export const contractDraftReviewRejected = {
  ...contractDraft,
  version: 2,
  creditReview: "NONE",
  latestCreditReview: {
    ...pendingReview,
    outcome: "REJECTED",
    decidedAt: "2026-11-26T05:00:00Z",
    decidedBy: "11111111-0000-4000-8000-000000000010",
    note: "Giảm phần trả sau giao xuống dưới 10 triệu.",
  },
};

export const contractDraftOverdue = {
  ...contractDraft,
  creditWarning: {
    outcome: "OVERDUE",
    creditLimit: 300_000_000,
    exposure: 41_195_000,
    afterDelivery: 27_142_500,
  },
};
