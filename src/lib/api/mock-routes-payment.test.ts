/**
 * Mock thanh toán theo hợp đồng (BE payment module 4B-6 / 4B-9, docs 15) — chạy qua axios thật + lớp api của
 * `features/payment`, nên kiểm luôn mock đúng hình BE và lớp api parse được. Kịch bản WF4 X03: đợt
 * `BEFORE_DELIVERY` gắn đợt giao chưa trả → kế toán lập phiếu thu → đợt `Paid`, hết chặn bàn giao.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getInstallment,
  getOrderInstallments,
  getOrderRefund,
  getReceipt,
  listInstallments,
  listReceipts,
  listRefunds,
  recordReceipt,
  recordRefund,
  voidReceipt,
  voidRefundRecord,
} from "@/features/payment/api";
import { todayInVietnam } from "@/features/payment/input-schemas";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { activateMockAdapter } from "./mock-adapter";
import { resetPaymentMockStore } from "./mock-payment-store";
import { mockCustomerUuid } from "./mock-routes-orders-store";

const originalAdapter = api.defaults.adapter;
const ORDER_X03 = "ORD-2026-0013";
const ACCOUNTANT = "USER-ACC-01";
const SALES = "USER-SALE-01";
const WAREHOUSE = "USER-WH-01";

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs(ACCOUNTANT));
afterEach(() => resetPaymentMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const receipt = (over: Partial<Parameters<typeof recordReceipt>[0]> = {}) => ({
  customerId: mockCustomerUuid("CUS-0009"),
  reference: "FT26313555001",
  receivedOn: todayInVietnam(),
  note: "",
  lines: [{ installmentId: `INST-${ORDER_X03}-2`, amount: "25000000" }],
  ...over,
});

describe("GET /installments", () => {
  it("lists earliest due first; filters by status, milestone and reached; sales may read too", async () => {
    const all = await listInstallments({ page: 0, size: 50 });
    expect(all.totalElements).toBeGreaterThan(8);
    const overdue = await listInstallments({ status: "OVERDUE" });
    expect(overdue.items.map((i) => i.orderNumber)).toEqual(["ORD-2026-0016"]);
    const receivables = await listInstallments({ milestone: "AFTER_DELIVERY", reached: true });
    expect(receivables.items.every((i) => i.milestone === "AFTER_DELIVERY" && !!i.reachedAt)).toBe(
      true,
    );
    actAs(SALES);
    expect((await listInstallments({ orderId: undefined })).totalElements).toBe(all.totalElements);
  });

  it("without payment-installments:READ the list is 403", async () => {
    actAs(WAREHOUSE);
    expect((await errorOf(listInstallments({}))).status).toBe(403);
  });

  it("an order's installments carry the derived payment status and what must be paid before handover (docs 15 §5.2)", async () => {
    const order = await getOrderInstallments(ORDER_X03);
    expect(order).toMatchObject({
      paymentStatus: "PARTIALLY_PAID",
      onSigningPaid: true,
      beforeDeliveryUnpaid: 50_000_000,
      dueBeforeHandover: 50_000_000,
    });
    expect(order.installments.find((i) => i.deliveryBatchSeq === 1)?.status).toBe("DUE");
    expect((await errorOf(getOrderInstallments("ORD-NONE"))).code).toBe("INSTALLMENT_NOT_FOUND");
  });
});

describe("WF4 X03 — customer pays the BEFORE_DELIVERY installment of delivery batch 1", () => {
  it("records a receipt: installment → Paid, handover of batch 1 unblocked, receipt visible on the installment", async () => {
    const saved = await recordReceipt(receipt());
    expect(saved).toMatchObject({ status: "RECORDED", amount: 25_000_000 });
    const paid = await getInstallment(`INST-${ORDER_X03}-2`);
    expect(paid).toMatchObject({ status: "PAID", outstanding: 0 });
    expect(paid.receipts?.map((r) => r.reference)).toContain("FT26313555001");
    const order = await getOrderInstallments(ORDER_X03);
    // Batch 2 still blocks its own handover
    expect(order.beforeDeliveryUnpaid).toBe(25_000_000);
  });

  it("voiding the receipt puts the installment back to Due and frees the reference (BR-03, §4.4)", async () => {
    const saved = await recordReceipt(receipt());
    const voided = await voidReceipt({
      id: saved.receiptId,
      reason: "Ghi nhầm đợt",
      holdOrders: false,
    });
    expect(voided).toMatchObject({ status: "VOIDED", voidReason: "Ghi nhầm đợt" });
    expect((await getInstallment(`INST-${ORDER_X03}-2`)).status).toBe("DUE");
    await expect(recordReceipt(receipt())).resolves.toMatchObject({ status: "RECORDED" });
    expect(
      (await errorOf(voidReceipt({ id: saved.receiptId, reason: "x", holdOrders: false }))).code,
    ).toBe("PAYMENT_RECEIPT_ALREADY_VOIDED");
  });
});

describe("POST /payment-receipts — BE rules", () => {
  it("BR-03: a statement reference already on a live receipt is refused", async () => {
    expect((await errorOf(recordReceipt(receipt({ reference: "FT26313123456" })))).code).toBe(
      "PAYMENT_RECEIPT_REFERENCE_IN_USE",
    );
  });

  it("BR-05: above the outstanding, an installment of another customer, a paid one — each with its own code", async () => {
    expect(
      (
        await errorOf(
          recordReceipt(
            receipt({ lines: [{ installmentId: `INST-${ORDER_X03}-2`, amount: "25000001" }] }),
          ),
        )
      ).code,
    ).toBe("PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING");
    expect(
      (await errorOf(recordReceipt(receipt({ customerId: mockCustomerUuid("CUS-0001") })))).code,
    ).toBe("INSTALLMENT_CUSTOMER_MISMATCH");
    expect(
      (
        await errorOf(
          recordReceipt(
            receipt({ lines: [{ installmentId: `INST-${ORDER_X03}-1`, amount: "1" }] }),
          ),
        )
      ).code,
    ).toBe("INSTALLMENT_NOT_PAYABLE");
  });

  it("one receipt pays two installments of the same customer; a future date is a validation error", async () => {
    const saved = await recordReceipt(
      receipt({
        lines: [
          { installmentId: `INST-${ORDER_X03}-2`, amount: "25000000" },
          { installmentId: `INST-${ORDER_X03}-3`, amount: "5000000" },
        ],
      }),
    );
    expect(saved.lines).toHaveLength(2);
    expect((await getInstallment(`INST-${ORDER_X03}-3`)).status).toBe("PARTIALLY_PAID");
    expect(
      (await errorOf(recordReceipt(receipt({ reference: "FT-FUTURE", receivedOn: "2999-01-01" }))))
        .code,
    ).toBe("VALIDATION_FAILED");
  });

  it("permissions: only payment-receipts:CREATE records, only :UPDATE voids", async () => {
    actAs(SALES);
    expect((await errorOf(recordReceipt(receipt()))).status).toBe(403);
    expect(
      (await errorOf(voidReceipt({ id: "RCP-0001", reason: "x", holdOrders: false }))).status,
    ).toBe(403);
    actAs(ACCOUNTANT);
    const page = await listReceipts({ reference: "FT26313123456" });
    expect(page.items).toHaveLength(1);
    expect((await getReceipt(page.items[0]!.receiptId)).lines[0]).toMatchObject({
      contractNumber: expect.any(String),
    });
  });
});

describe("refunds (docs 15 §4.5, BR-14)", () => {
  const ORDER = "ORD-2026-0015";

  it("lists the order to refund and records within what is left; more than that is refused", async () => {
    expect((await listRefunds({ outstanding: true })).items.map((r) => r.orderNumber)).toEqual([
      ORDER,
    ]);
    const detail = await getOrderRefund(ORDER);
    expect(detail).toMatchObject({
      refundStatus: "PENDING",
      refundable: 12_000_000,
      remaining: 12_000_000,
    });
    const input = {
      orderId: ORDER,
      amount: "5000000",
      refundedOn: todayInVietnam(),
      reference: "FT26313987654",
      note: "",
    };
    const after = await recordRefund(input);
    expect(after).toMatchObject({
      refundStatus: "PARTIALLY_REFUNDED",
      refunded: 5_000_000,
      remaining: 7_000_000,
    });
    expect(
      (await errorOf(recordRefund({ ...input, reference: "FT2", amount: "7000001" }))).code,
    ).toBe("REFUND_EXCEEDS_REFUNDABLE");
    expect((await errorOf(recordRefund({ ...input, amount: "100" }))).code).toBe(
      "REFUND_REFERENCE_IN_USE",
    );
  });

  it("voiding a record gives its amount back as still to refund, and cannot be done twice", async () => {
    const recorded = await recordRefund({
      orderId: ORDER,
      amount: "12000000",
      refundedOn: todayInVietnam(),
      reference: "FT26313987655",
      note: "",
    });
    expect(recorded.refundStatus).toBe("REFUNDED");
    const recordId = recorded.records![0]!.refundRecordId;
    const reopened = await voidRefundRecord({ recordId, reason: "Nhập nhầm" });
    expect(reopened).toMatchObject({ refundStatus: "PENDING", remaining: 12_000_000 });
    expect((await errorOf(voidRefundRecord({ recordId, reason: "again" }))).code).toBe(
      "REFUND_RECORD_ALREADY_VOIDED",
    );
  });

  it("sales may read refunds but not record them", async () => {
    actAs(SALES);
    expect((await listRefunds({})).totalElements).toBeGreaterThan(0);
    expect(
      (
        await errorOf(
          recordRefund({
            orderId: ORDER,
            amount: "1",
            refundedOn: todayInVietnam(),
            reference: "FT3",
            note: "",
          }),
        )
      ).status,
    ).toBe(403);
  });
});
