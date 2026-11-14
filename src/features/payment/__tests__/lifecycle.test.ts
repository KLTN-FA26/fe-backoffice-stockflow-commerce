import { describe, expect, it } from "vitest";

import {
  INSTALLMENT_API_STATUSES,
  INSTALLMENT_STATUS_BY_API,
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
  RECEIPT_API_STATUSES,
  RECEIPT_STATUS_BY_API,
} from "@/constants/payment";

import {
  INSTALLMENT_TRANSITIONS,
  RECEIPT_TRANSITIONS,
  allowedInstallmentActions,
  allowedReceiptActions,
  allowedRefundActions,
  allowedRefundRecordActions,
  installmentTakesMoney,
} from "../lifecycle";
import { blocksHandover, deliveryBatchLabel, payableInstallments } from "../selectors";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Installment } from "../types";

const ACCOUNTANT_CAN = new Set<string>([
  ...Object.values(PAYMENT_INSTALLMENT_PERMISSIONS),
  ...Object.values(PAYMENT_RECEIPT_PERMISSIONS),
  ...Object.values(PAYMENT_REFUND_PERMISSIONS),
]);
const SALES_CAN = new Set<string>([
  PAYMENT_INSTALLMENT_PERMISSIONS.viewPage,
  PAYMENT_INSTALLMENT_PERMISSIONS.read,
  PAYMENT_REFUND_PERMISSIONS.viewPage,
  PAYMENT_REFUND_PERMISSIONS.read,
]);
const has = (set: Set<string>) => (code: PermissionCode) => set.has(code);
const nobody = has(new Set());

describe("status strings (docs 15 §5.1, §5.3 — verbatim)", () => {
  it("maps every BE installment status to the docs status", () => {
    expect(INSTALLMENT_STATUS_BY_API).toEqual({
      NOT_DUE: "Not Due",
      DUE: "Due",
      PARTIALLY_PAID: "Partially Paid",
      PAID: "Paid",
      OVERDUE: "Overdue",
      CANCELLED: "Cancelled",
    });
    expect(RECEIPT_STATUS_BY_API).toEqual({ RECORDED: "Recorded", VOIDED: "Voided" });
  });
});

describe("INSTALLMENT_TRANSITIONS (docs 15 §5.1)", () => {
  it("covers every status; Paid and Cancelled are terminal", () => {
    expect(Object.keys(INSTALLMENT_TRANSITIONS).sort()).toEqual(
      [...INSTALLMENT_API_STATUSES].sort(),
    );
    expect(INSTALLMENT_TRANSITIONS.PAID).toEqual([]);
    expect(INSTALLMENT_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("Not Due → Due | Partially Paid | Paid (customer pays early) | Cancelled", () => {
    expect(INSTALLMENT_TRANSITIONS.NOT_DUE).toEqual(["DUE", "PARTIALLY_PAID", "PAID", "CANCELLED"]);
  });

  it("Overdue only goes to Paid or Cancelled — it stays overdue until paid in full", () => {
    expect(INSTALLMENT_TRANSITIONS.OVERDUE).toEqual(["PAID", "CANCELLED"]);
  });

  it("BR-05: only unpaid, uncancelled installments take money — including Not Due", () => {
    expect(INSTALLMENT_API_STATUSES.filter(installmentTakesMoney)).toEqual([
      "NOT_DUE",
      "DUE",
      "PARTIALLY_PAID",
      "OVERDUE",
    ]);
  });
});

describe("RECEIPT_TRANSITIONS (docs 15 §5.3, BR-04)", () => {
  it("Recorded only goes to Voided; Voided is terminal (a receipt is never edited)", () => {
    expect(Object.keys(RECEIPT_TRANSITIONS).sort()).toEqual([...RECEIPT_API_STATUSES].sort());
    expect(RECEIPT_TRANSITIONS.RECORDED).toEqual(["VOIDED"]);
    expect(RECEIPT_TRANSITIONS.VOIDED).toEqual([]);
  });
});

describe("action gating by permission code (three roles' worth of grants)", () => {
  it("accountant grants: record a receipt on a Due installment, void a Recorded receipt", () => {
    expect(allowedInstallmentActions({ status: "DUE" }, has(ACCOUNTANT_CAN))).toEqual([
      "recordReceipt",
    ]);
    expect(allowedReceiptActions({ status: "RECORDED" }, has(ACCOUNTANT_CAN))).toEqual([
      "voidReceipt",
    ]);
  });

  it("sales grants (read only): no mutating action anywhere", () => {
    const can = has(SALES_CAN);
    expect(allowedInstallmentActions({ status: "DUE" }, can)).toEqual([]);
    expect(allowedReceiptActions({ status: "RECORDED" }, can)).toEqual([]);
    expect(allowedRefundActions({ remaining: 10 }, can)).toEqual([]);
    expect(allowedRefundRecordActions({ status: "RECORDED" }, can)).toEqual([]);
  });

  it("no grants: nothing", () => {
    expect(allowedInstallmentActions({ status: "NOT_DUE" }, nobody)).toEqual([]);
    expect(allowedReceiptActions({ status: "RECORDED" }, nobody)).toEqual([]);
  });

  it("terminal states render no mutating action even for the accountant", () => {
    const can = has(ACCOUNTANT_CAN);
    expect(allowedInstallmentActions({ status: "PAID" }, can)).toEqual([]);
    expect(allowedInstallmentActions({ status: "CANCELLED" }, can)).toEqual([]);
    expect(allowedReceiptActions({ status: "VOIDED" }, can)).toEqual([]);
    expect(allowedRefundRecordActions({ status: "VOIDED" }, can)).toEqual([]);
  });

  it("BR-14: recording a refund needs something left to refund", () => {
    const can = has(ACCOUNTANT_CAN);
    expect(allowedRefundActions({ remaining: 5_000_000 }, can)).toEqual(["recordRefund"]);
    expect(allowedRefundActions({ remaining: 0 }, can)).toEqual([]);
  });
});

const installment = (over: Partial<Installment>): Installment => ({
  installmentId: "i-1",
  contractId: "c-1",
  contractNumber: "HD-1",
  orderId: "o-1",
  orderNumber: "SO-1",
  customerId: "cu-1",
  seq: 1,
  name: "Đợt",
  milestone: "BEFORE_DELIVERY",
  amount: 100,
  paidAmount: 0,
  reducedAmount: 0,
  outstanding: 100,
  currency: "VND",
  status: "DUE",
  transferReference: "HD-1 DOT1",
  ...over,
});

describe("selectors", () => {
  it("BR-08: an unpaid BEFORE_DELIVERY installment blocks the handover; paid or cancelled does not", () => {
    expect(blocksHandover(installment({}))).toBe(true);
    expect(blocksHandover(installment({ status: "PAID" }))).toBe(false);
    expect(blocksHandover(installment({ status: "CANCELLED" }))).toBe(false);
    expect(blocksHandover(installment({ milestone: "AFTER_DELIVERY" }))).toBe(false);
  });

  it("names the delivery batch an installment is tied to (docs 15 §4.1)", () => {
    expect(deliveryBatchLabel({ deliveryBatchSeq: 2 })).toBe("Đợt giao 2");
    expect(deliveryBatchLabel({ deliveryBatchSeq: null })).toBe("Không gắn đợt giao");
    expect(deliveryBatchLabel({})).toBe("Không gắn đợt giao");
  });

  it("payableInstallments keeps only installments that still take money", () => {
    const rows = [
      installment({ installmentId: "a" }),
      installment({ installmentId: "b", status: "PAID", outstanding: 0 }),
      installment({ installmentId: "c", status: "NOT_DUE" }),
      installment({ installmentId: "d", status: "CANCELLED" }),
    ];
    expect(payableInstallments(rows).map((r) => r.installmentId)).toEqual(["a", "c"]);
  });
});
