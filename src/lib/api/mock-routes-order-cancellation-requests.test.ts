/**
 * Mock yêu cầu huỷ của khách + kết quả tất toán (BE `CancellationRequestController`, `RefundController`, docs 17 §4.8,
 * §5.4) — chạy qua axios thật + `features/order/*-api.ts`, nên kiểm luôn mock đúng hình BE và lớp api parse được: quyền
 * (`sales-order-cancellations:READ` / `:UPDATE`, `payment-refunds:READ`), hàng đợi, duyệt → huỷ đơn, từ chối bắt buộc lý
 * do, yêu cầu hết hiệu lực khi đơn đã đóng gói, phí chỉ sau khi in.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrder } from "@/features/order/api";
import {
  approveCancellationRequest,
  getOrderRefund,
  listCancellationRequests,
  rejectCancellationRequest,
} from "@/features/order/cancellation-request-api";
import { cancellationSettlementOf } from "@/features/order/components/cancellation/CancellationSettlementPanel";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";

const originalAdapter = api.defaults.adapter;

const orderWith = (status: string) => {
  const order = orders.find((o) => o.status === status);
  if (!order) throw new Error(`mock-data không có đơn "${status}"`);
  return order;
};

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

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

/** Yêu cầu đang chờ của một đơn (hàng đợi đã seed). */
async function pendingOf(orderId: string) {
  const page = await listCancellationRequests({ orderId, status: "PENDING" });
  const request = page.items[0];
  if (!request) throw new Error("Đơn không có yêu cầu đang chờ");
  return request;
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-SALE-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /orders/cancellation-requests", () => {
  it("Sale đọc được hàng đợi: ba yêu cầu đang chờ trên đơn đã release, mới nhất trước", async () => {
    const page = await listCancellationRequests({ status: "PENDING" });
    expect(page.totalElements).toBe(3);
    const times = page.items.map((r) => r.requestedAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(page.items.every((r) => r.status === "PENDING")).toBe(true);
    // Khách chỉ chọn CUSTOMER_REQUEST / DUPLICATE_ORDER / OTHER (docs 17 §4.8 bước 29)
    expect(
      page.items.every((r) =>
        ["CUSTOMER_REQUEST", "DUPLICATE_ORDER", "OTHER"].includes(r.reasonCode),
      ),
    ).toBe(true);
  });

  it("lọc theo orderId và phân trang theo BE PageResponse (từ 0)", async () => {
    const picking = orderWith("Picking");
    const page = await listCancellationRequests({ orderId: picking.orderId, page: 0, size: 1 });
    expect(page).toMatchObject({ page: 0, size: 1, totalElements: 1, hasNext: false });
    const second = await listCancellationRequests({ status: "PENDING", page: 1, size: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.hasPrevious).toBe(true);
  });

  it("thiếu sales-order-cancellations:READ (Kế toán đọc được đơn nhưng KHÔNG đọc hàng đợi) → 403", async () => {
    actAs("USER-ACC-01");
    expect((await captureError(listCancellationRequests({}))).status).toBe(403);
    actAs("USER-WH-01");
    expect((await captureError(listCancellationRequests({}))).status).toBe(403);
  });

  it("status lạ → 400 UNSUPPORTED_PARAMETER (BE enum CancellationRequestStatus)", async () => {
    expect(await captureError(listCancellationRequests({ status: "WITHDRAWN" }))).toMatchObject({
      status: 400,
      code: "UNSUPPORTED_PARAMETER",
    });
  });

  it("đơn Packed có yêu cầu EXPIRED kèm ghi chú — không còn trong hàng đợi chờ", async () => {
    const packed = orderWith("Packed");
    const all = await listCancellationRequests({ orderId: packed.orderId });
    expect(all.items[0]).toMatchObject({ status: "EXPIRED" });
    expect(all.items[0]?.decisionNote).toBeTruthy();
    expect(
      (await listCancellationRequests({ orderId: packed.orderId, status: "PENDING" })).items,
    ).toHaveLength(0);
  });
});

describe("POST …/cancellation-requests/:requestId/approval", () => {
  it("duyệt (đơn chưa in) → đơn Cancelled, yêu cầu Approved + ghi chú quyết định, rời hàng đợi", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    const order = await approveCancellationRequest({
      orderId: picking.orderId,
      requestId: request.requestId,
      note: "Đồng ý huỷ",
    });
    expect(order.status).toBe("Cancelled");
    expect((await getOrder(picking.orderId)).status).toBe("Cancelled");
    const decided = (await listCancellationRequests({ orderId: picking.orderId })).items[0];
    expect(decided).toMatchObject({ status: "APPROVED", decisionNote: "Đồng ý huỷ" });
    expect((await listCancellationRequests({ status: "PENDING" })).totalElements).toBe(2);
  });

  it("duyệt xong: tất toán hoàn toàn bộ tiền đã thu, không phí (docs 17 §4.8 bước 30: chưa in)", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    await approveCancellationRequest({
      orderId: picking.orderId,
      requestId: request.requestId,
      note: "",
    });
    const settlement = cancellationSettlementOf(await getOrderRefund(picking.orderId));
    expect(settlement).toMatchObject({
      kind: "ORDER_CANCELLED",
      collected: picking.amountPaid,
      fee: 0,
      refundable: picking.amountPaid,
      feeOwed: 0,
    });
  });

  it("chưa in mà giữ phí (% hoặc thoả thuận) → 409 CANCELLATION_FEE_BEFORE_PRINTING và KHÔNG huỷ gì", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    const base = { orderId: picking.orderId, requestId: request.requestId, note: "" };
    expect(
      await captureError(approveCancellationRequest({ ...base, retainedPercent: 20 })),
    ).toMatchObject({
      status: 409,
      code: "CANCELLATION_FEE_BEFORE_PRINTING",
    });
    expect(
      (
        await captureError(
          approveCancellationRequest({
            ...base,
            agreedFee: { amount: 1000, reason: "r", detail: "d" },
          }),
        )
      ).code,
    ).toBe("CANCELLATION_FEE_BEFORE_PRINTING");
    expect((await getOrder(picking.orderId)).status).not.toBe("Cancelled");
    expect((await pendingOf(picking.orderId)).status).toBe("PENDING");
  });

  it("đơn đã in (In Production) giữ theo %: tiền đã thu trả phí trước, phần thừa phải hoàn", async () => {
    const printing = orderWith("In Production");
    const request = await pendingOf(printing.orderId);
    await approveCancellationRequest({
      orderId: printing.orderId,
      requestId: request.requestId,
      note: "",
      retainedPercent: 30,
    });
    const settlement = cancellationSettlementOf(await getOrderRefund(printing.orderId));
    const fee = Math.round((printing.amountPaid * 30) / 100);
    expect(settlement).toMatchObject({ collected: printing.amountPaid, fee, feePercent: 30 });
    expect(settlement?.refundable).toBe(printing.amountPaid - Math.min(fee, printing.amountPaid));
    expect(settlement?.feeOwed).toBe(fee - Math.min(fee, printing.amountPaid));
  });

  it("đơn đã in giữ số tiền thoả thuận: kèm lý do + chi tiết, tiền đã thu trả phí trước, phần thừa phải hoàn", async () => {
    const printing = orderWith("In Production");
    const request = await pendingOf(printing.orderId);
    await approveCancellationRequest({
      orderId: printing.orderId,
      requestId: request.requestId,
      note: "",
      agreedFee: { amount: 100_000, reason: "Phôi đã in", detail: "Thoả thuận qua điện thoại" },
    });
    const settlement = cancellationSettlementOf(await getOrderRefund(printing.orderId));
    expect(settlement).toMatchObject({
      fee: 100_000,
      feeCovered: 100_000,
      refundable: printing.amountPaid - 100_000,
      feeOwed: 0,
      feeReason: "Phôi đã in",
      feeDetail: "Thoả thuận qua điện thoại",
    });
  });

  it("số tiền thoả thuận vượt giá trị đơn → 400 và KHÔNG huỷ gì (BE `requireAgreedFee`)", async () => {
    const printing = orderWith("In Production");
    const request = await pendingOf(printing.orderId);
    const error = await captureError(
      approveCancellationRequest({
        orderId: printing.orderId,
        requestId: request.requestId,
        note: "",
        agreedFee: { amount: printing.grandTotal + 1, reason: "r", detail: "d" },
      }),
    );
    expect(error.status).toBe(400);
    expect((await getOrder(printing.orderId)).status).not.toBe("Cancelled");
  });

  it("không giữ phí khi gửi cả % lẫn số tiền → 400; % ngoài 0–100 → 400", async () => {
    const printing = orderWith("In Production");
    const request = await pendingOf(printing.orderId);
    const base = { orderId: printing.orderId, requestId: request.requestId, note: "" };
    expect(
      (
        await captureError(
          approveCancellationRequest({
            ...base,
            retainedPercent: 10,
            agreedFee: { amount: 1000, reason: "r", detail: "d" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await captureError(approveCancellationRequest({ ...base, retainedPercent: 101 }))).status,
    ).toBe(400);
  });

  it("duyệt lần hai / yêu cầu đã hết hiệu lực → 409 ORDER_CANCELLATION_REQUEST_NOT_PENDING", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    await approveCancellationRequest({
      orderId: picking.orderId,
      requestId: request.requestId,
      note: "",
    });
    expect(
      await captureError(
        approveCancellationRequest({
          orderId: picking.orderId,
          requestId: request.requestId,
          note: "",
        }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_CANCELLATION_REQUEST_NOT_PENDING" });
    const packed = orderWith("Packed");
    const expired = (await listCancellationRequests({ orderId: packed.orderId })).items[0];
    expect(
      (
        await captureError(
          approveCancellationRequest({
            orderId: packed.orderId,
            requestId: expired?.requestId ?? "",
            note: "",
          }),
        )
      ).code,
    ).toBe("ORDER_CANCELLATION_REQUEST_NOT_PENDING");
  });

  it("đơn tới mức không huỷ được trong lúc yêu cầu còn chờ (đã dán nhãn / đóng gói) → yêu cầu tự Expired, duyệt bị từ chối", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    const { setMockOrderStatus } = await import("./mock-routes-orders");
    setMockOrderStatus(picking.orderId, "PACKED");
    expect(
      await captureError(
        approveCancellationRequest({
          orderId: picking.orderId,
          requestId: request.requestId,
          note: "",
        }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_CANCELLATION_REQUEST_NOT_PENDING" });
    expect((await listCancellationRequests({ orderId: picking.orderId })).items[0]?.status).toBe(
      "EXPIRED",
    );
  });

  it("yêu cầu của đơn khác / id lạ → 404 CANCELLATION_REQUEST_NOT_FOUND", async () => {
    const picking = orderWith("Picking");
    const other = orderWith("In Production");
    const request = await pendingOf(picking.orderId);
    expect(
      (
        await captureError(
          approveCancellationRequest({
            orderId: other.orderId,
            requestId: request.requestId,
            note: "",
          }),
        )
      ).code,
    ).toBe("CANCELLATION_REQUEST_NOT_FOUND");
    expect(
      (
        await captureError(
          approveCancellationRequest({
            orderId: picking.orderId,
            requestId: "CREQ-NOPE",
            note: "",
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("thiếu sales-order-cancellations:UPDATE (chỉ đọc hàng đợi) → 403, KHÔNG huỷ gì", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    actAs("USER-ACC-01");
    expect(
      (
        await captureError(
          approveCancellationRequest({
            orderId: picking.orderId,
            requestId: request.requestId,
            note: "",
          }),
        )
      ).status,
    ).toBe(403);
    actAs("USER-SALE-01");
    expect((await getOrder(picking.orderId)).status).toBe("Picking");
  });
});

describe("POST …/cancellation-requests/:requestId/rejection", () => {
  it("từ chối kèm lý do → yêu cầu Rejected, đơn tiếp tục", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    const rejected = await rejectCancellationRequest({
      orderId: picking.orderId,
      requestId: request.requestId,
      note: "Hàng đã lấy xong",
    });
    expect(rejected).toMatchObject({ status: "REJECTED", decisionNote: "Hàng đã lấy xong" });
    expect((await getOrder(picking.orderId)).status).toBe("Picking");
  });

  it("thiếu lý do → 400 (BE @NotBlank); đã từ chối rồi → 409 NOT_PENDING", async () => {
    const picking = orderWith("Picking");
    const request = await pendingOf(picking.orderId);
    const base = { orderId: picking.orderId, requestId: request.requestId };
    expect((await captureError(rejectCancellationRequest({ ...base, note: "" }))).status).toBe(400);
    await rejectCancellationRequest({ ...base, note: "Không được" });
    expect((await captureError(rejectCancellationRequest({ ...base, note: "Lại" }))).code).toBe(
      "ORDER_CANCELLATION_REQUEST_NOT_PENDING",
    );
  });
});

describe("GET /refunds/orders/:id", () => {
  it("cần payment-refunds:READ: Sale / Kế toán đọc được, nhân viên kho → 403", async () => {
    const order = orderWith("Picking");
    expect((await getOrderRefund(order.orderId)).refundStatus).toBe("NONE");
    actAs("USER-ACC-01");
    expect((await getOrderRefund(order.orderId)).settlements).toEqual([]);
    actAs("USER-WH-01");
    expect((await captureError(getOrderRefund(order.orderId))).status).toBe(403);
  });
});
