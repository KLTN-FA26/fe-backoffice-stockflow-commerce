import { describe, expect, it } from "vitest";

import {
  buildReceiptInputSchema,
  buildRefundRecordInputSchema,
  todayInVietnam,
  voidInputSchema,
} from "../input-schemas";
import {
  installmentDtoSchema,
  installmentPageDtoSchema,
  orderInstallmentsDtoSchema,
  orderRefundDtoSchema,
  receiptDtoSchema,
} from "../schemas";

/** Hình dạng JSON của BE (Jackson `non_null`: trường chưa đặt vắng mặt) — `InstallmentResponse`. */
const installmentJson = {
  installmentId: "6f1c0000-0000-4000-8000-000000000001",
  contractId: "6f1c0000-0000-4000-8000-0000000000c1",
  contractNumber: "HD-20261108-000007-1",
  orderId: "6f1c0000-0000-4000-8000-0000000000a1",
  orderNumber: "SO-20261108-000007",
  customerId: "6f1c0000-0000-4000-8000-0000000000b1",
  seq: 2,
  name: "Trả trước đợt giao 1",
  milestone: "BEFORE_DELIVERY",
  deliveryBatchSeq: 1,
  amount: 25000000,
  paidAmount: 0,
  reducedAmount: 0,
  outstanding: 25000000,
  currency: "VND",
  reachedAt: "2026-11-11T02:00:00Z",
  status: "DUE",
  overdue: false,
  transferReference: "HD-20261108-000007-1 DOT2",
};

describe("DTO contract (BE InstallmentResponse / OrderInstallmentsResponse / PaymentReceiptResponse / OrderRefundResponse)", () => {
  it("parses a page of installments; dueDate / dueDays / paidAt are optional", () => {
    const page = installmentPageDtoSchema.parse({
      items: [installmentJson],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items[0]).toMatchObject({ milestone: "BEFORE_DELIVERY", deliveryBatchSeq: 1 });
    expect(page.items[0]?.dueDate).toBeUndefined();
  });

  // WF-05 BO-11 (audit C-32): BE gửi chuỗi và còn thêm giá trị — một giá trị lạ không làm hỏng cả màn
  it("reads a status / milestone the FE does not know as UNKNOWN instead of failing the page", () => {
    const page = installmentPageDtoSchema.parse({
      items: [{ ...installmentJson, status: "FAILED", milestone: "ON_PROGRESS" }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items[0]).toMatchObject({ status: "UNKNOWN", milestone: "UNKNOWN" });
  });

  it("parses an order's installments with the derived payment status (docs 15 §5.2)", () => {
    const order = orderInstallmentsDtoSchema.parse({
      orderId: installmentJson.orderId,
      orderNumber: installmentJson.orderNumber,
      contractNumber: installmentJson.contractNumber,
      total: 50000000,
      paid: 0,
      outstanding: 50000000,
      onSigningPaid: true,
      beforeDeliveryUnpaid: 25000000,
      dueBeforeHandover: 25000000,
      currency: "VND",
      installments: [installmentJson],
    });
    expect(order.paymentStatus).toBeUndefined();
    expect(order.beforeDeliveryUnpaid).toBe(25000000);
  });

  it("parses a voided receipt with its history, and a refund with settlements and records", () => {
    const receipt = receiptDtoSchema.parse({
      receiptId: "r-1",
      customerId: "cu-1",
      reference: "FT26313123456",
      receivedOn: "2026-11-09",
      amount: 100,
      currency: "VND",
      status: "VOIDED",
      recordedAt: "2026-11-09T03:00:00Z",
      voidedAt: "2026-11-10T03:00:00Z",
      voidReason: "Nhầm khách",
      lines: [{ installmentId: "i-1", amount: 100 }],
    });
    expect(receipt.voidReason).toBe("Nhầm khách");
    const refund = orderRefundDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      currency: "VND",
      refundStatus: "PARTIALLY_REFUNDED",
      refundable: 100,
      refunded: 40,
      remaining: 60,
      settlements: [
        {
          settlementId: "s-1",
          kind: "GOODS_RETURNED",
          collected: 100,
          closed: 0,
          reduced: 0,
          surplus: 100,
          fee: 0,
          feeCovered: 0,
          refundable: 100,
          feeOwed: 0,
          settledAt: "2026-11-10T03:00:00Z",
        },
      ],
      records: [],
    });
    expect(refund.settlements?.[0]?.kind).toBe("GOODS_RETURNED");
  });
});

describe("buildReceiptInputSchema (docs 15 §3, BR-03, BR-05)", () => {
  const outstanding = new Map([
    ["i-1", 25_000_000],
    ["i-2", 10_000_000],
  ]);
  const schema = buildReceiptInputSchema((id) => outstanding.get(id));
  const valid = {
    customerId: "cu-1",
    reference: "FT26313123456",
    receivedOn: "2026-11-01",
    note: "",
    lines: [{ installmentId: "i-1", amount: "25000000" }],
  };

  it("accepts one line paying exactly what is still owed", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("requires a statement reference of at most 100 characters from the allowed set", () => {
    expect(schema.safeParse({ ...valid, reference: " " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reference: "x".repeat(101) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reference: "FT<script>" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reference: "FT 26/313:#1-a_b.c" }).success).toBe(true);
  });

  it("receivedOn must not be in the future (Vietnam time)", () => {
    expect(schema.safeParse({ ...valid, receivedOn: todayInVietnam() }).success).toBe(true);
    expect(schema.safeParse({ ...valid, receivedOn: "2999-01-01" }).success).toBe(false);
  });

  it("BR-05: a line may not exceed what the installment still owes — there is no surplus", () => {
    const result = schema.safeParse({
      ...valid,
      lines: [{ installmentId: "i-1", amount: "25000001" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["lines", 0, "amount"]);
  });

  it("amounts are whole dong of at least 1; at least one line; no installment twice", () => {
    expect(
      schema.safeParse({ ...valid, lines: [{ installmentId: "i-1", amount: "0" }] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...valid, lines: [{ installmentId: "i-1", amount: "1.5" }] }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...valid, lines: [] }).success).toBe(false);
    expect(
      schema.safeParse({
        ...valid,
        lines: [
          { installmentId: "i-1", amount: "1000" },
          { installmentId: "i-1", amount: "1000" },
        ],
      }).success,
    ).toBe(false);
  });

  it("one transfer paying two installments is one receipt with two lines (BR-05)", () => {
    expect(
      schema.safeParse({
        ...valid,
        lines: [
          { installmentId: "i-1", amount: "25000000" },
          { installmentId: "i-2", amount: "4000000" },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("voidInputSchema (docs 15 §4.4) and buildRefundRecordInputSchema (BR-14)", () => {
  it("voiding needs a reason of at most 500 characters", () => {
    expect(voidInputSchema.safeParse({ reason: "  ", holdOrders: false }).success).toBe(false);
    expect(voidInputSchema.safeParse({ reason: "x".repeat(501), holdOrders: false }).success).toBe(
      false,
    );
    expect(voidInputSchema.safeParse({ reason: "Nhầm khách", holdOrders: true }).success).toBe(
      true,
    );
  });

  it("a refund record may not exceed what is still to refund", () => {
    const schema = buildRefundRecordInputSchema(12_000_000);
    const base = { refundedOn: "2026-11-01", reference: "FT26313987654", note: "" };
    expect(schema.safeParse({ ...base, amount: "12000000" }).success).toBe(true);
    expect(schema.safeParse({ ...base, amount: "12000001" }).success).toBe(false);
    expect(schema.safeParse({ ...base, amount: "5000000", refundedOn: "2999-01-01" }).success).toBe(
      false,
    );
  });
});

describe("InstallmentResponse after the WF-05 fix plan", () => {
  it("reads overdue as the BE's flag, and is a contract error without it (§8)", () => {
    expect(installmentDtoSchema.parse({ ...installmentJson, overdue: true }).overdue).toBe(true);
    const { overdue: _overdue, ...withoutFlag } = installmentJson;
    expect(installmentDtoSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it("parses a failed-trip fee, paid like an installment (WF-05 §2-3)", () => {
    expect(
      installmentDtoSchema.parse({ ...installmentJson, milestone: "FAILED_TRIP_FEE" }).milestone,
    ).toBe("FAILED_TRIP_FEE");
  });
});

describe("WF-05 BO-11 / F-9: tolerant enums and the carrier-return settlement", () => {
  const settlement = {
    settlementId: "s-1",
    collected: 100,
    closed: 100,
    reduced: 0,
    surplus: 100,
    fee: 0,
    feeCovered: 0,
    refundable: 100,
    feeOwed: 0,
    settledAt: "2026-11-24T03:00:00Z",
  };

  it("reads SHIPMENT_RETURNED as a known kind and the order's open fees (feeOwed)", () => {
    const refund = orderRefundDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      currency: "VND",
      refundStatus: "PENDING",
      refundable: 100,
      refunded: 0,
      remaining: 100,
      feeOwed: 30,
      settlements: [{ ...settlement, kind: "SHIPMENT_RETURNED" }],
    });
    expect(refund.settlements?.[0]?.kind).toBe("SHIPMENT_RETURNED");
    expect(refund.feeOwed).toBe(30);
    // BE G2: the shipment it closed and the shipping fee waived (Q-19)
    const carrier = orderRefundDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      currency: "VND",
      refundStatus: "PENDING",
      refundable: 100,
      refunded: 0,
      remaining: 100,
      settlements: [
        { ...settlement, kind: "SHIPMENT_RETURNED", shipmentId: "sh-1", shippingFeeWaived: 20 },
      ],
    });
    expect(carrier.settlements?.[0]).toMatchObject({ shipmentId: "sh-1", shippingFeeWaived: 20 });
  });

  it("an old BE without feeOwed still parses", () => {
    const refund = orderRefundDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      currency: "VND",
      refundStatus: "NONE",
      refundable: 0,
      refunded: 0,
      remaining: 0,
    });
    expect(refund.feeOwed).toBeUndefined();
  });

  it("an unknown settlement kind, refund status, receipt status or payment status reads UNKNOWN", () => {
    const refund = orderRefundDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      currency: "VND",
      refundStatus: "ON_HOLD",
      refundable: 100,
      refunded: 0,
      remaining: 100,
      settlements: [{ ...settlement, kind: "SOMETHING_NEW" }],
      records: [
        {
          refundRecordId: "rr-1",
          orderId: "o-1",
          orderNumber: "SO-1",
          customerId: "cu-1",
          amount: 10,
          currency: "VND",
          refundedOn: "2026-11-24",
          reference: "FT1",
          status: "REVERSED",
          recordedAt: "2026-11-24T03:00:00Z",
        },
      ],
    });
    expect(refund.refundStatus).toBe("UNKNOWN");
    expect(refund.settlements?.[0]?.kind).toBe("UNKNOWN");
    expect(refund.records?.[0]?.status).toBe("UNKNOWN");
    const receipt = receiptDtoSchema.parse({
      receiptId: "r-1",
      customerId: "cu-1",
      reference: "FT1",
      receivedOn: "2026-11-09",
      amount: 100,
      currency: "VND",
      status: "ARCHIVED",
      recordedAt: "2026-11-09T03:00:00Z",
      lines: [{ installmentId: "i-1", amount: 100, milestone: "NEW_MILESTONE" }],
    });
    expect(receipt.status).toBe("UNKNOWN");
    expect(receipt.lines[0]?.milestone).toBe("UNKNOWN");
    const order = orderInstallmentsDtoSchema.parse({
      orderId: "o-1",
      orderNumber: "SO-1",
      contractNumber: "HD-1",
      paymentStatus: "OVERPAID",
      total: 1,
      paid: 1,
      outstanding: 0,
      onSigningPaid: true,
      beforeDeliveryUnpaid: 0,
      dueBeforeHandover: 0,
      currency: "VND",
      installments: [],
    });
    expect(order.paymentStatus).toBe("UNKNOWN");
  });
});
