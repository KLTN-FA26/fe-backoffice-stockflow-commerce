/**
 * API yêu cầu huỷ (BE `CancellationRequestController`): query hàng đợi, body duyệt / từ chối, Idempotency-Key.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  approveCancellationRequest,
  getOrderRefund,
  listCancellationRequests,
  rejectCancellationRequest,
} from "./cancellation-request-api";

afterEach(() => vi.restoreAllMocks());

const requestDto = {
  requestId: "r-1",
  orderId: "o-1",
  reasonCode: "OTHER",
  note: "đổi ý",
  requestedAt: "2026-11-12T03:00:00Z",
  status: "PENDING",
};

describe("listCancellationRequests — GET /orders/cancellation-requests", () => {
  it("gửi page / size / status / orderId đúng tên tham số BE", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [requestDto],
        page: 2,
        size: 5,
        totalElements: 11,
        totalPages: 3,
        hasNext: false,
        hasPrevious: true,
      },
    });
    const page = await listCancellationRequests({
      page: 2,
      size: 5,
      status: "PENDING",
      orderId: "o-1",
    });
    expect(get.mock.calls[0]?.[0]).toBe("/orders/cancellation-requests");
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(Object.fromEntries(params)).toEqual({
      page: "2",
      size: "5",
      status: "PENDING",
      orderId: "o-1",
    });
    expect(page.items[0]).toMatchObject({ requestId: "r-1", note: "đổi ý", decidedAt: null });
    expect(page.totalElements).toBe(11);
  });

  it("không gửi status / orderId khi không lọc; trang âm bị đưa về 0", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    });
    await listCancellationRequests({ page: -3 });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(params.has("status")).toBe(false);
    expect(params.has("orderId")).toBe(false);
    expect(params.get("page")).toBe("0");
  });

  it("response sai hợp đồng (items không phải mảng) → từ chối, không trả dữ liệu chưa validate", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { items: "x" } });
    await expect(listCancellationRequests({})).rejects.toThrow();
  });
});

describe("approveCancellationRequest — POST …/cancellation-requests/{id}/approval", () => {
  const orderDto = {
    orderId: "o-1",
    orderNumber: "SO-1",
    customerId: "c-1",
    status: "CANCELLED",
    totalAmount: 100,
    currency: "VND",
    lines: [],
    placedAt: "2026-11-01T00:00:00Z",
  };

  it("không phí → body rỗng ({}), id được mã hoá trong path, trả đơn đã huỷ", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: orderDto });
    const order = await approveCancellationRequest({ orderId: "o/1", requestId: "r 1", note: "" });
    expect(post).toHaveBeenCalledWith(
      "/orders/o%2F1/cancellation-requests/r%201/approval",
      {},
      undefined,
    );
    expect(order.status).toBe("Cancelled");
  });

  it("ghi chú + % giữ lại + Idempotency-Key (header, không vào body)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: orderDto });
    await approveCancellationRequest({
      orderId: "o-1",
      requestId: "r-1",
      note: "Đã in 30%",
      retainedPercent: 30,
      idempotencyKey: "k-1",
    });
    expect(post).toHaveBeenCalledWith(
      "/orders/o-1/cancellation-requests/r-1/approval",
      { note: "Đã in 30%", retainedPercent: 30 },
      { headers: { "Idempotency-Key": "k-1" } },
    );
  });

  it("số tiền thoả thuận → agreedFee {amount, reason, detail}, không có retainedPercent", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: orderDto });
    const agreedFee = { amount: 500_000, reason: "Phôi", detail: "Gọi điện" };
    await approveCancellationRequest({ orderId: "o-1", requestId: "r-1", note: "", agreedFee });
    expect(post.mock.calls[0]?.[1]).toEqual({ agreedFee });
  });
});

describe("rejectCancellationRequest — POST …/rejection", () => {
  it("body chỉ có note; trả yêu cầu đã từ chối", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: { ...requestDto, status: "REJECTED", decisionNote: "đã in rồi" },
    });
    const request = await rejectCancellationRequest({
      orderId: "o-1",
      requestId: "r-1",
      note: "đã in rồi",
    });
    expect(post).toHaveBeenCalledWith(
      "/orders/o-1/cancellation-requests/r-1/rejection",
      { note: "đã in rồi" },
      undefined,
    );
    expect(request).toMatchObject({ status: "REJECTED", decisionNote: "đã in rồi" });
  });
});

describe("getOrderRefund — GET /refunds/orders/{id}", () => {
  it("parse kết quả tất toán (đã thu / phí / phải hoàn / phí còn thiếu)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        orderId: "o-1",
        currency: "VND",
        refundStatus: "PENDING",
        settlements: [
          {
            settlementId: "s-1",
            kind: "ORDER_CANCELLED",
            collected: 1000,
            fee: 300,
            feeCovered: 300,
            refundable: 700,
            feeOwed: 0,
          },
        ],
      },
    });
    const refund = await getOrderRefund("o 1");
    expect(get.mock.calls[0]?.[0]).toBe("/refunds/orders/o%201");
    expect(refund.settlements?.[0]).toMatchObject({ collected: 1000, refundable: 700 });
  });
});
