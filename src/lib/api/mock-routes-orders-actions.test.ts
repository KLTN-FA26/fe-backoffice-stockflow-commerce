/**
 * Mock routes release / credit hold / lệnh sản xuất — chạy qua axios thật + lớp api của
 * feature, kiểm mã lỗi + thứ tự kiểm khớp BE (OrderReleaseService, CreditHoldService).
 * `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên của adapter.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  approveCreditHold,
  listCreditHolds,
  listOrderProductionOrders,
  rejectCreditHold,
  releaseOrder,
} from "@/features/order/action-api";
import { getOrder } from "@/features/order/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";

const originalAdapter = api.defaults.adapter;

// Đơn cụ thể trong mock-data (không sửa được) — xem dump trạng thái trong mock-routes-orders-store
const CONFIRMED_STANDARD = "ORD-2026-0013"; // Confirmed, chỉ hàng sẵn
const CREDIT_ON_HOLD = "ORD-2026-0006"; // On Hold, chuyển khoản → CREDIT
const DEPOSIT_PENDING = "ORD-2026-0014"; // Pending Payment, dòng in → DEPOSIT, thiết kế Draft/Ready
const IN_PRODUCTION = "ORD-2026-0011"; // In Production, 1 dòng in
const SHIPPED = "ORD-2026-0007";

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

describe("POST /orders/:id/release (SCRUM-423)", () => {
  it("đơn Confirmed chỉ hàng sẵn → Ready to Fulfill, ghi kho xuất", async () => {
    const released = await releaseOrder({ id: CONFIRMED_STANDARD, warehouseId: "WH-HN-01" });
    expect(released.status).toBe("Ready to Fulfill");
    expect(released.warehouseId).toBe("WH-HN-01");
    expect(released.releasedAt).toBeTruthy();
  });

  it("kho không tồn tại → WAREHOUSE_NOT_FOUND", async () => {
    const error = await captureError(releaseOrder({ id: CONFIRMED_STANDARD, warehouseId: "WH-X" }));
    expect(error.code).toBe("WAREHOUSE_NOT_FOUND");
  });

  it("BR-PRD-08: dòng in chưa có mẫu duyệt → DESIGN_SAMPLE_NOT_APPROVED (kiểm trước cọc)", async () => {
    const error = await captureError(
      releaseOrder({ id: DEPOSIT_PENDING, warehouseId: "WH-HN-01" }),
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe("DESIGN_SAMPLE_NOT_APPROVED");
  });

  it("release lần 2 / trạng thái không phải Confirmed → CONFLICT", async () => {
    await releaseOrder({ id: CONFIRMED_STANDARD, warehouseId: "WH-HN-01" });
    const error = await captureError(
      releaseOrder({ id: CONFIRMED_STANDARD, warehouseId: "WH-HN-01" }),
    );
    expect(error.code).toBe("CONFLICT");
    expect((await captureError(releaseOrder({ id: SHIPPED, warehouseId: "WH-HN-01" }))).code).toBe(
      "CONFLICT",
    );
  });
});

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

  it("từ chối SWITCH_TO_DEPOSIT → Pending Payment, đổi phương thức sang đặt cọc", async () => {
    const order = await rejectCreditHold({
      id: CREDIT_ON_HOLD,
      action: "SWITCH_TO_DEPOSIT",
      depositPercent: 30,
      note: "Khách chuyển cọc",
    });
    expect(order.status).toBe("Pending Payment");
    expect(order.paymentTerm).toBe("DEPOSIT");
  });

  it("từ chối CANCEL → Cancelled với lý do CREDIT_REJECTED", async () => {
    const order = await rejectCreditHold({ id: CREDIT_ON_HOLD, action: "CANCEL", note: "Quá hạn" });
    expect(order.status).toBe("Cancelled");
    expect(order.cancellation?.reasonCode).toBe("CREDIT_REJECTED");
  });
});

describe("GET /orders/:id/production-orders (contract pending)", () => {
  it("đơn In Production → LSX gốc + LSX con gia công trỏ về gốc (docs 19 BR-12)", async () => {
    const list = await listOrderProductionOrders(IN_PRODUCTION);
    const parent = list.find((po) => po.parentId === null);
    const child = list.find((po) => po.parentId !== null);
    expect(parent?.mode).toBe("IN_HOUSE");
    expect(child?.parentId).toBe(parent?.productionOrderId);
    expect(child?.mode).toBe("SUBCONTRACTED");
    expect(child?.subcontractorName).toBeTruthy();
  });

  it("đơn chưa release → chưa có LSX", async () => {
    expect(await listOrderProductionOrders(DEPOSIT_PENDING)).toEqual([]);
    expect((await getOrder(DEPOSIT_PENDING)).paymentTerm).toBe("DEPOSIT");
  });
});
