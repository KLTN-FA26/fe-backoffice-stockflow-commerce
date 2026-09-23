import { describe, expect, it } from "vitest";

import {
  ORDER_TRANSITIONS,
  allowedOrderActions,
  isOrderTerminal,
  nextOrderStatuses,
} from "./lifecycle";

import type { OrderStatus } from "./types";

/**
 * Nguồn: docs/ecommerce/17-order §5 + BE order/internal/domain/OrderStatus.java (9 giá trị).
 * 12 giá trị mock-only còn lại là terminal có chủ đích (BE không transition vào/ra).
 */
describe("ORDER_TRANSITIONS (docs 17-order §5)", () => {
  it("Draft → Pending Payment / Cancelled", () => {
    expect(nextOrderStatuses("Draft")).toEqual([
      "Pending Payment",
      "Cancelled",
    ] satisfies OrderStatus[]);
  });

  it("Pending Payment → Confirmed / Cancelled", () => {
    expect(nextOrderStatuses("Pending Payment")).toEqual([
      "Confirmed",
      "Cancelled",
    ] satisfies OrderStatus[]);
  });

  it("Confirmed → Ready to Fulfill / On Hold / Cancelled (BE PAID→IN_FULFILMENT/ON_HOLD)", () => {
    expect(nextOrderStatuses("Confirmed")).toEqual([
      "Ready to Fulfill",
      "On Hold",
      "Cancelled",
    ] satisfies OrderStatus[]);
  });

  it("Ready to Fulfill → Shipped / On Hold / Cancelled (BE IN_FULFILMENT)", () => {
    expect(nextOrderStatuses("Ready to Fulfill")).toEqual([
      "Shipped",
      "On Hold",
      "Cancelled",
    ] satisfies OrderStatus[]);
  });

  it("On Hold → Ready to Fulfill / Cancelled (BE ON_HOLD)", () => {
    expect(nextOrderStatuses("On Hold")).toEqual([
      "Ready to Fulfill",
      "Cancelled",
    ] satisfies OrderStatus[]);
  });

  it("BE BR-031; docs BR-03: Shipped chỉ còn Delivered — không còn Cancelled", () => {
    expect(nextOrderStatuses("Shipped")).toEqual(["Delivered"] satisfies OrderStatus[]);
    expect(nextOrderStatuses("Shipped")).not.toContain("Cancelled");
  });

  it("Delivered → Completed / Returned", () => {
    expect(nextOrderStatuses("Delivered")).toEqual([
      "Completed",
      "Returned",
    ] satisfies OrderStatus[]);
  });

  it("Completed / Cancelled / Returned là terminal — không transition nào", () => {
    expect(ORDER_TRANSITIONS.Completed).toEqual([]);
    expect(ORDER_TRANSITIONS.Cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.Returned).toEqual([]);
    expect(isOrderTerminal("Completed")).toBe(true);
    expect(isOrderTerminal("Cancelled")).toBe(true);
    expect(isOrderTerminal("Returned")).toBe(true);
  });

  it("phủ đủ 9 state BE trong bảng transition", () => {
    const beStates: OrderStatus[] = [
      "Draft",
      "Pending Payment",
      "Confirmed",
      "Ready to Fulfill",
      "Shipped",
      "Delivered",
      "Completed",
      "Cancelled",
      "Returned",
    ];
    for (const state of beStates) {
      expect(ORDER_TRANSITIONS[state]).toBeDefined();
    }
  });
});

describe("allowedOrderActions — action-gating theo status + role", () => {
  it("Sales Staff huỷ được đơn Pending Payment", () => {
    expect(allowedOrderActions("Pending Payment", "Sales Staff").map((a) => a.code)).toEqual([
      "admin-cancel",
    ]);
  });

  it("Order Coordinator huỷ được đơn Confirmed", () => {
    expect(allowedOrderActions("Confirmed", "Order Coordinator").map((a) => a.code)).toEqual([
      "admin-cancel",
    ]);
  });

  it("Warehouse Staff không có order.cancel → không thấy action nào", () => {
    expect(allowedOrderActions("Pending Payment", "Warehouse Staff")).toEqual([]);
    expect(allowedOrderActions("Confirmed", "Warehouse Staff")).toEqual([]);
  });

  it("System Admin huỷ được (short-circuit toàn quyền)", () => {
    expect(allowedOrderActions("Draft", "System Admin").map((a) => a.code)).toEqual([
      "admin-cancel",
    ]);
  });

  it("BE BR-031; docs BR-03: từ Shipped trở đi không role nào thấy nút huỷ", () => {
    const roles = ["Sales Staff", "Order Coordinator", "System Admin", "Warehouse Staff"] as const;
    for (const role of roles) {
      expect(allowedOrderActions("Shipped", role)).toEqual([]);
      expect(allowedOrderActions("Delivered", role)).toEqual([]);
      expect(allowedOrderActions("Completed", role)).toEqual([]);
    }
  });
});
