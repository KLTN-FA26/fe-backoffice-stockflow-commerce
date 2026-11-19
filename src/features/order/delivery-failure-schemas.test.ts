import { describe, expect, it } from "vitest";

import {
  CANCEL_UNDELIVERED_DEFAULTS,
  cancelUndeliveredInputSchema,
  deliveryFailureCaseSchema,
  redeliveryInputSchema,
} from "./delivery-failure-schemas";

/** Fixture theo BE `DeliveryFailureCaseResponse` (Jackson non_null: field null bị bỏ). */
const beCase = {
  caseId: "c0000000-0000-4000-8000-000000000001",
  orderId: "o0000000-0000-4000-8000-000000000001",
  orderNumber: "SO-20261108-000007",
  customerId: "u0000000-0000-4000-8000-000000000001",
  orderStatus: "ON_HOLD",
  shipmentId: "s0000000-0000-4000-8000-000000000001",
  receiptId: "r0000000-0000-4000-8000-000000000001",
  receiptNumber: "RR-20261110-0001",
  warehouseId: "w0000000-0000-4000-8000-000000000001",
  failureReason: "REFUSED",
  customerPaysFailedTrip: true,
  status: "OPEN",
  openedAt: "2026-11-10T03:00:00Z",
  carrierClaim: false,
  readyForRelease: false,
  lines: [{ orderLineId: "l1", units: 24, heldUnits: 0 }],
  cartons: [{ lpn: "LPN-1", sku: "SKU-1", quantity: 24 }],
  version: 0,
};

describe("deliveryFailureCaseSchema (contract BE DeliveryFailureCaseResponse)", () => {
  it("parse hồ sơ BE, field vắng → null", () => {
    const parsed = deliveryFailureCaseSchema.parse(beCase);
    expect(parsed.status).toBe("OPEN");
    expect(parsed.decisionNote).toBeNull();
    expect(parsed.failedTripFee).toBeNull();
    expect(parsed.cartons[0]?.lotNumber).toBeUndefined();
  });

  it("trạng thái / lý do lạ → UNKNOWN, không làm hỏng trang", () => {
    const parsed = deliveryFailureCaseSchema.parse({
      ...beCase,
      status: "ESCALATED",
      failureReason: "STORM",
    });
    expect(parsed.status).toBe("UNKNOWN");
    expect(parsed.failureReason).toBe("UNKNOWN");
  });
});

describe("redeliveryInputSchema (BE Redelivery, docs 09 §4.3)", () => {
  it("khách gây ra (REFUSED / WRONG_ADDRESS) → bắt buộc phí > 0 nguyên VND", () => {
    const schema = redeliveryInputSchema(true);
    expect(schema.safeParse({ note: "Khách hẹn lại", failedTripFee: "" }).success).toBe(false);
    expect(schema.safeParse({ note: "Khách hẹn lại", failedTripFee: "0" }).success).toBe(false);
    expect(schema.safeParse({ note: "Khách hẹn lại", failedTripFee: "1.5" }).success).toBe(false);
    expect(schema.parse({ note: "Khách hẹn lại", failedTripFee: "850000" })).toEqual({
      note: "Khách hẹn lại",
      failedTripFee: 850000,
    });
  });

  it("lý do khác → KHÔNG gửi phí (BE từ chối phí với lý do của hãng)", () => {
    expect(redeliveryInputSchema(false).parse({ note: "Giao lại", failedTripFee: "500" })).toEqual({
      note: "Giao lại",
      failedTripFee: undefined,
    });
  });

  it("ghi chú bắt buộc", () => {
    expect(redeliveryInputSchema(false).safeParse({ note: "  ", failedTripFee: "" }).success).toBe(
      false,
    );
  });
});

describe("cancelUndeliveredInputSchema (BE Cancellation + CancellationFeeRequest)", () => {
  it("không giữ phí → chỉ gửi ghi chú", () => {
    expect(
      cancelUndeliveredInputSchema.parse({ ...CANCEL_UNDELIVERED_DEFAULTS, note: "Khách huỷ" }),
    ).toEqual({ note: "Khách huỷ", agreedFee: undefined });
  });

  it("giữ phí → cần đủ số tiền, lý do, nội dung", () => {
    const base = { ...CANCEL_UNDELIVERED_DEFAULTS, note: "Khách huỷ", withFee: true };
    expect(cancelUndeliveredInputSchema.safeParse({ ...base, feeAmount: "100000" }).success).toBe(
      false,
    );
    expect(
      cancelUndeliveredInputSchema.parse({
        ...base,
        feeAmount: "100000",
        feeReason: "Hàng đã in",
        feeDetail: "Giữ tiền in 50 thùng",
      }),
    ).toEqual({
      note: "Khách huỷ",
      agreedFee: { amount: 100000, reason: "Hàng đã in", detail: "Giữ tiền in 50 thùng" },
    });
  });
});
