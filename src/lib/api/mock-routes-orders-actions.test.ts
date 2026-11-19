/**
 * Mock routes credit hold / lệnh sản xuất — chạy qua axios thật + lớp api của feature, kiểm mã
 * lỗi + thứ tự kiểm khớp BE (CreditHoldService). Release (PR #74): `mock-routes-order-delivery-mode.test.ts`.
 * `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên của adapter.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  approveCreditHold,
  getCreditPosition,
  listCreditHolds,
  listOrderProductionOrders,
  rejectCreditHold,
} from "@/features/order/action-api";
import { getOrder } from "@/features/order/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";
import { mockCustomerUuid } from "./mock-routes-orders-store";

const originalAdapter = api.defaults.adapter;

// Đơn cụ thể trong mock-data (không sửa được) — xem dump trạng thái trong mock-routes-orders-store
const CREDIT_ON_HOLD = "ORD-2026-0006"; // On Hold, chuyển khoản → CREDIT
const DEPOSIT_PENDING = "ORD-2026-0014"; // Pending Payment, dòng in → DEPOSIT, thiết kế Draft/Ready
const IN_PRODUCTION = "ORD-2026-0011"; // In Production, 1 dòng in

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
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

afterEach(() => resetOrderMockStore());

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

// POST /orders/:id/release: mock của PR #74 — `mock-routes-order-delivery-mode.test.ts`.

describe("credit hold (SCRUM-427)", () => {
  it("GET /orders/credit-holds chỉ trả đơn On Hold công nợ, kèm số liệu vượt hạn mức", async () => {
    const page = await listCreditHolds({ page: 0, size: 20 });
    expect(page.items.map((h) => h.order.orderId)).toEqual([CREDIT_ON_HOLD]);
    const hold = page.items[0];
    expect(hold?.order.paymentTerm).toBe("CREDIT");
    expect((hold?.exposure ?? 0) + (hold?.orderAmount ?? 0)).toBeGreaterThan(
      hold?.creditLimit ?? 0,
    );
  });

  it("duyệt → Confirmed, rời danh sách; duyệt lần 2 → ORDER_NOT_ON_CREDIT_HOLD", async () => {
    const approved = await approveCreditHold({ id: CREDIT_ON_HOLD, note: "Đã xác nhận" });
    expect(approved.status).toBe("Confirmed");
    expect((await listCreditHolds({})).items).toHaveLength(0);
    const error = await captureError(approveCreditHold({ id: CREDIT_ON_HOLD, note: "Lần 2" }));
    expect(error.code).toBe("ORDER_NOT_ON_CREDIT_HOLD");
  });

  it("thiếu ghi chú → VALIDATION_FAILED", async () => {
    const error = await captureError(approveCreditHold({ id: CREDIT_ON_HOLD, note: "" }));
    expect(error.code).toBe("VALIDATION_FAILED");
  });

  it("từ chối {note} → Cancelled với lý do CREDIT_REJECTED (BE CreditRefusalRequest)", async () => {
    const order = await rejectCreditHold({ id: CREDIT_ON_HOLD, note: "Quá hạn" });
    expect(order.status).toBe("Cancelled");
    expect(order.cancellation?.reasonCode).toBe("CREDIT_REJECTED");
  });
});

describe("GET /production-orders?salesOrderId= (hợp đồng BE ProductionOrderController#list, docs 17 §4.3)", () => {
  it("đơn In Production → Đơn sản xuất In Production, mỗi dòng in một phần, chưa nhập thùng nào", async () => {
    const list = await listOrderProductionOrders(IN_PRODUCTION);
    expect(list.length).toBeGreaterThan(0);
    for (const po of list) {
      expect(po).toMatchObject({ status: "IN_PRODUCTION", receivedCartons: 0 });
      expect(po.code).toMatch(/^PRD-\d{8}-\d{4}$/);
      expect(po.cartons).toBeGreaterThan(0);
    }
    const order = await getOrder(IN_PRODUCTION);
    expect(list.every((po) => order.lines.some((line) => line.lineId === po.orderLineId))).toBe(
      true,
    );
  });

  it("mock trả đúng hình BE: trang PageResponse, ProductionOrder có lines (không mảng trần)", async () => {
    const { data } = await api.get<{ items: Record<string, unknown>[]; hasNext: boolean }>(
      "/production-orders",
      { params: new URLSearchParams({ salesOrderId: IN_PRODUCTION }) },
    );
    expect(data.hasNext).toBe(false);
    expect(data.items[0]).toMatchObject({
      salesOrderId: IN_PRODUCTION,
      status: "IN_PRODUCTION",
      code: expect.stringMatching(/^PRD-\d{8}-\d{4}$/),
      lines: expect.arrayContaining([expect.objectContaining({ receivedCartons: 0 })]),
    });
    expect(data.items[0]).toHaveProperty("id");
    expect(data.items[0]).not.toHaveProperty("orderNumber");
  });

  it("đơn chưa release → chưa có Đơn sản xuất", async () => {
    expect(await listOrderProductionOrders(DEPOSIT_PENDING)).toEqual([]);
    expect((await getOrder(DEPOSIT_PENDING)).paymentTerm).toBe("DEPOSIT");
  });

  it("salesOrderId không tồn tại → trang rỗng, không 404 (BE chỉ lọc)", async () => {
    expect(await listOrderProductionOrders("ORD-KHONG-CO")).toEqual([]);
  });
});

describe("GET /orders/credit-position/:customerId (CreditHoldController#position)", () => {
  it("id khách trên đơn / credit hold là UUID cố định và khớp với credit position", async () => {
    const order = await getOrder(CREDIT_ON_HOLD);
    expect(order.customerId).toBe(mockCustomerUuid("CUS-0007"));
    expect(mockCustomerUuid("CUS-0007")).toBe(mockCustomerUuid("CUS-0007"));
    expect(mockCustomerUuid("CUS-0007")).not.toBe(mockCustomerUuid("CUS-0006"));
    const hold = (await listCreditHolds({})).items.find((h) => h.order.orderId === CREDIT_ON_HOLD);
    expect(hold?.order.customerId).toBe(order.customerId);

    const position = await getCreditPosition(order.customerId ?? "");
    expect(position.customerId).toBe(order.customerId);
  });

  it("khách có hạn mức / khách có nợ quá hạn / khách không bán trả sau", async () => {
    const many = await getCreditPosition(mockCustomerUuid("CUS-0007"));
    expect(many).toMatchObject({
      creditLimit: 100_000,
      currency: "VND",
      hasOverdue: false,
    });
    // Đơn đang chờ quyết định công nợ không tính vào dư nợ (BE undeliveredCreditExposure)
    expect(many.exposure).toBe(0);
    expect(many.availableCredit).toBe(100_000);

    const restricted = await getCreditPosition(mockCustomerUuid("CUS-0006"));
    expect(restricted.hasOverdue).toBe(true);

    const prepaidOnly = await getCreditPosition(mockCustomerUuid("CUS-0005"));
    expect(prepaidOnly).toMatchObject({
      creditLimit: null,
      availableCredit: null,
    });
  });

  it("khách không tồn tại → 404 CUSTOMER_NOT_FOUND", async () => {
    const error = await captureError(getCreditPosition("00000000-0000-4000-8000-000000000000"));
    expect(error.code).toBe("CUSTOMER_NOT_FOUND");
  });
});
