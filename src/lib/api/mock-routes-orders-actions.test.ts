/**
 * Mock routes release / credit hold / lệnh sản xuất — chạy qua axios thật + lớp api của
 * feature, kiểm mã lỗi + thứ tự kiểm khớp BE (OrderReleaseService, CreditHoldService).
 * `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên của adapter.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  approveCreditHold,
  getCreditPosition,
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
import { mockCustomerUuid } from "./mock-routes-orders-store";

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

  it("SWITCH_TO_DEPOSIT 50% → chi tiết đơn trả cọc đúng 50% (không về mặc định 30%)", async () => {
    await rejectCreditHold({
      id: CREDIT_ON_HOLD,
      action: "SWITCH_TO_DEPOSIT",
      depositPercent: 50,
      note: "Khách cọc nửa",
    });
    const detail = await getOrder(CREDIT_ON_HOLD);
    expect(detail.depositRequired).toBe(Math.round(detail.totalAmount * 0.5));
  });

  it("SWITCH_TO_DEPOSIT bỏ trống % → % cọc mặc định trong hồ sơ khách (= depositPercent của credit position)", async () => {
    const before = await getOrder(CREDIT_ON_HOLD);
    const position = await getCreditPosition(before.customerId ?? "");
    await rejectCreditHold({ id: CREDIT_ON_HOLD, action: "SWITCH_TO_DEPOSIT", note: "Mặc định" });
    const detail = await getOrder(CREDIT_ON_HOLD);
    expect(position.depositPercent).toBe(40);
    expect(detail.depositRequired).toBe(Math.round((detail.totalAmount * 40) / 100));
  });

  it("SWITCH_TO_DEPOSIT % ngoài (0, 100) → VALIDATION_FAILED, đơn vẫn On Hold", async () => {
    const error = await captureError(
      rejectCreditHold({
        id: CREDIT_ON_HOLD,
        action: "SWITCH_TO_DEPOSIT",
        depositPercent: 100,
        note: "Sai",
      }),
    );
    expect(error.code).toBe("VALIDATION_FAILED");
    expect((await getOrder(CREDIT_ON_HOLD)).status).toBe("On Hold");
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

  it("khách nhiều phương thức + cọc 40% / khách hạn chế (không cọc) có nợ quá hạn / khách chỉ trả trước", async () => {
    const many = await getCreditPosition(mockCustomerUuid("CUS-0007"));
    expect(many).toMatchObject({
      allowedTerms: ["PREPAID", "DEPOSIT", "CREDIT"],
      depositPercent: 40,
      creditLimit: 100_000,
      currency: "VND",
      hasOverdue: false,
    });
    // Đơn đang chờ quyết định công nợ không tính vào dư nợ (BE undeliveredCreditExposure)
    expect(many.exposure).toBe(0);
    expect(many.availableCredit).toBe(100_000);

    const restricted = await getCreditPosition(mockCustomerUuid("CUS-0006"));
    expect(restricted.allowedTerms).toEqual(["PREPAID", "CREDIT"]);
    expect(restricted.depositPercent).toBeNull();
    expect(restricted.hasOverdue).toBe(true);

    const prepaidOnly = await getCreditPosition(mockCustomerUuid("CUS-0005"));
    expect(prepaidOnly).toMatchObject({
      allowedTerms: ["PREPAID"],
      depositPercent: null,
      creditLimit: null,
      availableCredit: null,
    });
  });

  it("khách không tồn tại → 404 CUSTOMER_NOT_FOUND", async () => {
    const error = await captureError(getCreditPosition("00000000-0000-4000-8000-000000000000"));
    expect(error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("từ chối chuyển sang phương thức khách không được phép → 409 PAYMENT_TERM_NOT_ALLOWED, đơn vẫn On Hold", async () => {
    // CUS-0006 không có DEPOSIT trong hồ sơ — giả lập đơn công nợ của khách này đang chờ duyệt
    const { orders } = await import("@/lib/mock-data");
    const target = orders.find((o) => o.customerId === "CUS-0006");
    if (!target) throw new Error("seed thiếu đơn của CUS-0006");
    const { applyTransition } = await import("./mock-routes-orders-store");
    applyTransition(target, "ON_HOLD", null, { paymentTerm: "CREDIT" });

    const error = await captureError(
      rejectCreditHold({ id: target.orderId, action: "SWITCH_TO_DEPOSIT", note: "Thử" }),
    );
    expect(error.code).toBe("PAYMENT_TERM_NOT_ALLOWED");
    expect((await getOrder(target.orderId)).status).toBe("On Hold");
  });
});
