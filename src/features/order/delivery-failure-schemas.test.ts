import { describe, expect, it } from "vitest";

import {
  CANCEL_UNDELIVERED_DEFAULTS,
  LOST_CLOSURE_DEFAULTS,
  cancelUndeliveredInputSchema,
  deliveryFailureCaseSchema,
  lostClosureInputSchema,
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

  it("F-4 closure: đã biết giữ nguyên; vắng (BE cũ) / lạ → null, không làm hỏng trang", () => {
    expect(
      deliveryFailureCaseSchema.parse({
        ...beCase,
        status: "CANCELLED",
        closure: "RECORDED_ON_RETURN",
      }).closure,
    ).toBe("RECORDED_ON_RETURN");
    expect(deliveryFailureCaseSchema.parse(beCase).closure).toBeNull();
    expect(deliveryFailureCaseSchema.parse({ ...beCase, closure: "BY_ROBOT" }).closure).toBeNull();
  });
});

describe("lostClosureInputSchema (Q-12, F-5 + PR-0 ORDER_SHIPMENT_LOSS_EVIDENCE_REQUIRED)", () => {
  it("ghi chú bắt buộc, tối đa 1000", () => {
    expect(
      lostClosureInputSchema.safeParse({ ...LOST_CLOSURE_DEFAULTS, evidenceUploadId: "u-1" })
        .success,
    ).toBe(false);
    expect(
      lostClosureInputSchema.safeParse({ note: "x".repeat(1001), evidenceUploadId: "u-1" }).success,
    ).toBe(false);
  });

  it("thiếu tệp xác nhận của hãng → không gửi được", () => {
    const result = lostClosureInputSchema.safeParse({
      note: "GHN xác nhận mất",
      evidenceUploadId: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["evidenceUploadId"]);
  });

  it("đủ → trim ghi chú", () => {
    expect(
      lostClosureInputSchema.parse({ note: "  GHN xác nhận mất ", evidenceUploadId: "u-1" }),
    ).toEqual({ note: "GHN xác nhận mất", evidenceUploadId: "u-1" });
  });
});

describe("cancelUndeliveredInputSchema (BE Cancellation + CancellationFeeRequest)", () => {
  it("không giữ phí → chỉ gửi ghi chú", () => {
    expect(
      cancelUndeliveredInputSchema.parse({ ...CANCEL_UNDELIVERED_DEFAULTS, note: "Khách huỷ" }),
    ).toEqual({ note: "Khách huỷ", agreedFee: undefined, feeBearer: undefined });
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
        feeBearer: "COMPANY",
      }),
    ).toEqual({
      note: "Khách huỷ",
      agreedFee: { amount: 100000, reason: "Hàng đã in", detail: "Giữ tiền in 50 thùng" },
      feeBearer: "COMPANY",
    });
    // D50: đủ phí mà chưa chọn bên chịu phí → chặn
    expect(
      cancelUndeliveredInputSchema.safeParse({
        ...base,
        feeAmount: "100000",
        feeReason: "Hàng đã in",
        feeDetail: "Giữ tiền in 50 thùng",
      }).success,
    ).toBe(false);
  });
});
