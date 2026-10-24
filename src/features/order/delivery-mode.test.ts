/**
 * Hình thức giao (BE PR #157, LP-1/LP-2): schema DTO, cổng quyền theo mã, luật FTL / COD, body release (hình thức chỉ
 * gửi khi đổi), mục lịch sử `DELIVERY_MODE_CHANGE` và câu lỗi tiếng Việt.
 */
import { describe, expect, it } from "vitest";

import { ORDER_DELIVERY_MODE_UI, ORDER_ERROR_MESSAGES, ORDER_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { toOrder } from "./api";
import { deliveryModeControl, ftlConflictsWithCod } from "./delivery-mode";
import { releaseDeliveryMode } from "./delivery-mode-api";
import { ORDER_STALE_ERROR_CODES, orderActionErrorView } from "./errors";
import { toOrderHistoryEntry } from "./history-api";
import { deliveryModeSchema } from "./input-schemas";
import { allowedOrderActions } from "./lifecycle";
import { orderDtoSchema } from "./schemas";

import { apiOrder } from "./__fixtures__/order";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "./types";

const canOf =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);
const COORDINATOR = canOf(ORDER_PERMISSIONS.approve, ORDER_PERMISSIONS.deliveryModes);
const SALES = canOf(ORDER_PERMISSIONS.cancel, ORDER_PERMISSIONS.partialShipment);

describe("OrderResponse.deliveryMode / deliveryModeLocked (BE PR #157)", () => {
  it("parse và chuyển sang model FE", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...apiOrder,
        deliveryMode: "FULL_TRUCKLOAD",
        deliveryModeLocked: true,
      }),
    );
    expect(order.deliveryMode).toBe("FULL_TRUCKLOAD");
    expect(order.deliveryModeLocked).toBe(true);
  });

  it("vắng (dòng danh sách / BE cũ) → null, không đoán PARCEL", () => {
    const order = toOrder(orderDtoSchema.parse(apiOrder));
    expect(order.deliveryMode).toBeNull();
    expect(order.deliveryModeLocked).toBeNull();
  });

  it("giá trị lạ → UNKNOWN (hiện 'Không rõ'), không làm hỏng cả đơn", () => {
    const order = toOrder(orderDtoSchema.parse({ ...apiOrder, deliveryMode: "DRONE" }));
    expect(order.deliveryMode).toBe("UNKNOWN");
  });
});

describe("deliveryModeControl — cổng quyền theo mã sales-order-delivery-modes:UPDATE", () => {
  const open = { deliveryMode: "PARCEL", deliveryModeLocked: false } as const;

  it("có mã quyền + chưa khoá → đổi được", () => {
    expect(deliveryModeControl(open, COORDINATOR)).toEqual({
      mode: "PARCEL",
      locked: false,
      canChange: true,
    });
  });

  it("thiếu mã quyền (Sales, chỉ đọc) → vẫn thấy hình thức, không đổi được", () => {
    expect(deliveryModeControl(open, SALES)?.canChange).toBe(false);
    expect(deliveryModeControl(open, canOf())?.canChange).toBe(false);
    expect(deliveryModeControl(open, SALES)?.mode).toBe("PARCEL");
  });

  it("đã khoá (kho đã đóng gói / qua đóng gói / huỷ / đóng) → không đổi được dù có quyền", () => {
    expect(
      deliveryModeControl(
        { deliveryMode: "FULL_TRUCKLOAD", deliveryModeLocked: true },
        COORDINATOR,
      ),
    ).toEqual({ mode: "FULL_TRUCKLOAD", locked: true, canChange: false });
  });

  it("BE không trả hình thức → null (ẩn thẻ); không trả cờ khoá → coi là khoá, không đoán đơn còn mở", () => {
    expect(
      deliveryModeControl({ deliveryMode: null, deliveryModeLocked: null }, COORDINATOR),
    ).toBeNull();
    expect(
      deliveryModeControl({ deliveryMode: "PARCEL", deliveryModeLocked: null }, COORDINATOR)
        ?.canChange,
    ).toBe(false);
  });
});

describe("LP-2 — FTL không đi cùng thu tiền khi giao (COD)", () => {
  it("chỉ FTL + đơn CỌC có cách thu phần còn lại ON_DELIVERY mới xung đột (luật của BE ck_order_ftl_no_cod)", () => {
    const deposit = (balancePolicy: Order["balancePolicy"]) => ({
      paymentTerm: "DEPOSIT" as const,
      balancePolicy,
    });
    expect(ftlConflictsWithCod(deposit("ON_DELIVERY"), "FULL_TRUCKLOAD")).toBe(true);
    expect(ftlConflictsWithCod(deposit("ON_DELIVERY"), "PARCEL")).toBe(false);
    expect(ftlConflictsWithCod(deposit("BEFORE_DELIVERY"), "FULL_TRUCKLOAD")).toBe(false);
    expect(ftlConflictsWithCod(deposit("ON_CREDIT"), "FULL_TRUCKLOAD")).toBe(false);
    expect(ftlConflictsWithCod(deposit(null), "FULL_TRUCKLOAD")).toBe(false);
  });

  it("không phải đơn cọc thì không xung đột, dù cách thu ghi ON_DELIVERY hay phương thức thanh toán là COD", () => {
    expect(
      ftlConflictsWithCod(
        { paymentTerm: "PREPAID", balancePolicy: "ON_DELIVERY" },
        "FULL_TRUCKLOAD",
      ),
    ).toBe(false);
    expect(ftlConflictsWithCod({ paymentTerm: null, balancePolicy: null }, "FULL_TRUCKLOAD")).toBe(
      false,
    );
  });

  it("câu báo đúng lời yêu cầu: Sale đổi cách thu trước", () => {
    expect(ORDER_DELIVERY_MODE_UI.ftlNoCod).toBe(
      "Đơn thu tiền khi giao (COD) không giao nguyên xe được — Sale đổi cách thu trước.",
    );
  });
});

describe("releaseDeliveryMode — hình thức chỉ gửi khi KHÁC hình thức hiện tại của đơn", () => {
  it("giữ nguyên → undefined (body release không có deliveryMode)", () => {
    expect(releaseDeliveryMode("PARCEL", "PARCEL")).toBeUndefined();
    expect(releaseDeliveryMode("FULL_TRUCKLOAD", "FULL_TRUCKLOAD")).toBeUndefined();
  });

  it("đổi → gửi hình thức mới", () => {
    expect(releaseDeliveryMode("FULL_TRUCKLOAD", "PARCEL")).toBe("FULL_TRUCKLOAD");
    expect(releaseDeliveryMode("PARCEL", "FULL_TRUCKLOAD")).toBe("PARCEL");
  });

  it("không biết hình thức hiện tại (null / UNKNOWN) → gửi lựa chọn của người dùng, không bỏ", () => {
    expect(releaseDeliveryMode("PARCEL", null)).toBe("PARCEL");
    expect(releaseDeliveryMode("FULL_TRUCKLOAD", "UNKNOWN")).toBe("FULL_TRUCKLOAD");
  });
});

describe("deliveryModeSchema (DeliveryModeRequest)", () => {
  it("hình thức bắt buộc, ghi chú ≤ 500 ký tự và được trim", () => {
    expect(
      deliveryModeSchema.parse({
        deliveryMode: "FULL_TRUCKLOAD",
        note: "  Khách lấy 2 container  ",
      }),
    ).toEqual({
      deliveryMode: "FULL_TRUCKLOAD",
      note: "Khách lấy 2 container",
    });
    expect(deliveryModeSchema.safeParse({ deliveryMode: "TRUCK", note: "" }).success).toBe(false);
    expect(
      deliveryModeSchema.safeParse({ deliveryMode: "PARCEL", note: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      deliveryModeSchema.safeParse({ deliveryMode: "PARCEL", note: "x".repeat(500) }).success,
    ).toBe(true);
  });
});

describe("release trong bảng thao tác (BE OrderReleaseController, sales-orders:APPROVE)", () => {
  const codes = (
    status: Parameters<typeof allowedOrderActions>[0],
    can: ReturnType<typeof canOf>,
  ) => allowedOrderActions(status, can).map((action) => action.code);

  it("đơn Confirmed + có APPROVE → có 'release'; thiếu APPROVE (Sales, chỉ đọc) → không", () => {
    expect(codes("Confirmed", COORDINATOR)).toContain("release");
    expect(codes("Confirmed", SALES)).not.toContain("release");
    expect(codes("Confirmed", canOf())).not.toContain("release");
  });

  it("chỉ đơn Confirmed: các trạng thái khác (đã release, huỷ, đã giao) không có", () => {
    for (const status of [
      "Pending Payment",
      "Ready to Fulfill",
      "In Production",
      "Picking",
      "Shipped",
      "Cancelled",
    ] as const)
      expect(codes(status, COORDINATOR)).not.toContain("release");
  });
});

describe("lịch sử DELIVERY_MODE_CHANGE", () => {
  const base = {
    occurredAt: "2026-10-22T04:00:00Z",
    actorName: "Điều phối A",
    reason: "Khách lấy 2 container",
  };

  it("map thành mục 'delivery-mode' kèm hình thức trước, ghi chú và người đổi", () => {
    const entry = toOrderHistoryEntry({
      ...base,
      type: "DELIVERY_MODE_CHANGE",
      deliveryMode: "FULL_TRUCKLOAD",
      previousDeliveryMode: "PARCEL",
    });
    expect(entry).toEqual({
      kind: "delivery-mode",
      mode: "FULL_TRUCKLOAD",
      previousMode: "PARCEL",
      occurredAt: base.occurredAt,
      reason: "Khách lấy 2 container",
      actorName: "Điều phối A",
    });
  });

  it("chọn lúc release (không có hình thức trước) → previousMode null; thiếu hình thức → mục 'unknown'", () => {
    expect(
      toOrderHistoryEntry({ ...base, type: "DELIVERY_MODE_CHANGE", deliveryMode: "PARCEL" }),
    ).toMatchObject({ kind: "delivery-mode", previousMode: null });
    expect(toOrderHistoryEntry({ ...base, type: "DELIVERY_MODE_CHANGE" }).kind).toBe("unknown");
  });
});

describe("lỗi release / đổi hình thức giao → câu tiếng Việt", () => {
  const apiError = (status: number, code: string) =>
    new ApiError(status, code, "English message", undefined, "t-1");

  it.each(["release", "deliveryMode"] as const)(
    "%s: 409 DELIVERY_MODE_FTL_NO_COD → 'Sale đổi cách thu trước'",
    (action) => {
      const view = orderActionErrorView(apiError(409, "DELIVERY_MODE_FTL_NO_COD"), action);
      expect(view.detail).toBe(ORDER_ERROR_MESSAGES.DELIVERY_MODE_FTL_NO_COD);
      expect(view.detail).toMatch(/Sale đổi cách thu trước/);
      expect(view.detail).not.toContain("English");
      expect(view.traceId).toBe("t-1");
    },
  );

  it("409 DELIVERY_MODE_LOCKED → giải thích khoá và là lỗi dữ liệu cũ (đóng dialog, tải lại đơn)", () => {
    const view = orderActionErrorView(apiError(409, "DELIVERY_MODE_LOCKED"), "deliveryMode");
    expect(view.detail).toMatch(/Không đổi được hình thức giao nữa/);
    expect(view.title).toBe("Không đổi được hình thức giao");
    expect(ORDER_STALE_ERROR_CODES).toContain("DELIVERY_MODE_LOCKED");
    // FTL_NO_COD thì không: giữ dialog để người dùng đổi hình thức khác
    expect(ORDER_STALE_ERROR_CODES).not.toContain("DELIVERY_MODE_FTL_NO_COD");
  });

  it("403 khi release / đổi hình thức → nói thiếu quyền đổi hình thức giao; thao tác khác vẫn câu chung", () => {
    expect(orderActionErrorView(apiError(403, "FORBIDDEN"), "release").detail).toBe(
      ORDER_DELIVERY_MODE_UI.forbidden,
    );
    expect(orderActionErrorView(apiError(403, "FORBIDDEN"), "hold").detail).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it.each([
    "WAREHOUSE_NOT_FOUND",
    "WAREHOUSE_INACTIVE",
    "DESIGN_SAMPLE_NOT_APPROVED",
    "ORDER_DEPOSIT_NOT_RECEIVED",
    "CUSTOMER_CREDIT_OVERDUE",
  ])("release: %s có câu tiếng Việt riêng", (code) => {
    const view = orderActionErrorView(apiError(409, code), "release");
    expect(view.title).toBe("Không release được đơn");
    expect(view.detail).toBe(ORDER_ERROR_MESSAGES[code as keyof typeof ORDER_ERROR_MESSAGES]);
    expect(view.detail).not.toContain("English");
  });

  it("400 VALIDATION_FAILED → câu theo thao tác", () => {
    expect(orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "release").detail).toMatch(
      /kho xuất hàng/,
    );
    expect(orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "deliveryMode").detail).toMatch(
      /hình thức giao/,
    );
  });
});
