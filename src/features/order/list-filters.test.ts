import { describe, expect, it } from "vitest";

import { deliveryFailureCaseSchema } from "./delivery-failure-schemas";
import { matchesCancellationRequest, matchesDeliveryFailure } from "./list-filters";

import type { CancellationRequest } from "./cancellation-request-schemas";

const NO_REQUEST_FILTER = { crOrder: "", crCustomer: "", crReason: "" };
const NO_CASE_FILTER = { dfOrder: "", dfReceipt: "", dfReason: "" };

const request = (patch: Partial<CancellationRequest> = {}): CancellationRequest => ({
  requestId: "r-1",
  orderId: "o-1",
  reasonCode: "CUSTOMER_REQUEST",
  note: "Khách hoãn dự án",
  requestedAt: "2026-11-10T03:00:00Z",
  status: "PENDING",
  decidedAt: null,
  decisionNote: null,
  retainedPercent: null,
  requestedByName: null,
  decidedByName: null,
  orderNumber: "SO-20261101-000001",
  customerName: "Công ty Sao Mai",
  orderTotal: null,
  paidTotal: null,
  orderStatus: null,
  printingStarted: null,
  ...patch,
});

const failure = (patch: Record<string, unknown> = {}) =>
  deliveryFailureCaseSchema.parse({
    caseId: "c-1",
    orderId: "o-1",
    orderNumber: "SO-20261101-000001",
    shipmentId: "s-1",
    receiptNumber: "RR-20261120-0001",
    failureReason: "REFUSED",
    failureNote: "Khách không nhận",
    customerPaysFailedTrip: true,
    status: "CANCELLED",
    openedAt: "2026-11-20T03:00:00Z",
    ...patch,
  });

describe("matchesCancellationRequest", () => {
  it("không lọc → khớp", () => {
    expect(matchesCancellationRequest(request(), "", NO_REQUEST_FILTER)).toBe(true);
  });

  it("ô tìm quét mã đơn, khách, ghi chú — bỏ dấu, không phân biệt hoa thường", () => {
    expect(matchesCancellationRequest(request(), "sao mai", NO_REQUEST_FILTER)).toBe(true);
    expect(matchesCancellationRequest(request(), "hoan du an", NO_REQUEST_FILTER)).toBe(true);
    expect(matchesCancellationRequest(request(), "000001", NO_REQUEST_FILTER)).toBe(true);
    expect(matchesCancellationRequest(request(), "hoà bình", NO_REQUEST_FILTER)).toBe(false);
  });

  it("lọc cột: mã đơn, khách (chữ) và lý do (đúng mã)", () => {
    const row = request();
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crOrder: "000001" })).toBe(
      true,
    );
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crOrder: "000002" })).toBe(
      false,
    );
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crCustomer: "SAO" })).toBe(
      true,
    );
    expect(
      matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crReason: "CUSTOMER_REQUEST" }),
    ).toBe(true);
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crReason: "OTHER" })).toBe(
      false,
    );
  });

  it("BE chưa gửi mã đơn / tên khách → không khớp lọc theo cột đó (không đoán)", () => {
    const row = request({ orderNumber: null, customerName: null });
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crOrder: "SO" })).toBe(
      false,
    );
    expect(matchesCancellationRequest(row, "", { ...NO_REQUEST_FILTER, crCustomer: "a" })).toBe(
      false,
    );
  });
});

describe("matchesDeliveryFailure", () => {
  it("ô tìm quét mã đơn, phiếu nhận hàng hoàn, nhãn lý do, ghi chú", () => {
    const row = failure();
    expect(matchesDeliveryFailure(row, "rr-2026", "Khách từ chối", NO_CASE_FILTER)).toBe(true);
    expect(matchesDeliveryFailure(row, "tu choi", "Khách từ chối", NO_CASE_FILTER)).toBe(true);
    expect(matchesDeliveryFailure(row, "khong nhan", "Khách từ chối", NO_CASE_FILTER)).toBe(true);
    expect(matchesDeliveryFailure(row, "sai địa chỉ", "Khách từ chối", NO_CASE_FILTER)).toBe(false);
  });

  it("lọc cột: mã đơn, phiếu nhận (chữ) và lý do (đúng mã)", () => {
    const row = failure();
    const match = (filters: Partial<typeof NO_CASE_FILTER>) =>
      matchesDeliveryFailure(row, "", "Khách từ chối", { ...NO_CASE_FILTER, ...filters });
    expect(match({ dfOrder: "000001" })).toBe(true);
    expect(match({ dfReceipt: "0002" })).toBe(false);
    expect(match({ dfReason: "REFUSED" })).toBe(true);
    expect(match({ dfReason: "WRONG_ADDRESS" })).toBe(false);
  });

  it("chưa có phiếu nhận → không khớp lọc cột phiếu nhận", () => {
    const row = failure({ receiptNumber: undefined });
    expect(matchesDeliveryFailure(row, "", "", { ...NO_CASE_FILTER, dfReceipt: "RR" })).toBe(false);
  });
});
