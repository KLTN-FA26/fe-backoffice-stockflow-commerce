import { describe, expect, it } from "vitest";

import {
  ORDER_TRANSITIONS,
  allowedOrderActions,
  isOrderTerminal,
  nextOrderStatuses,
} from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { OrderStatus } from "./types";

/**
 * Nguồn: BE order/api/OrderStatus.java#canTransitionTo (10 giá trị, ON_HOLD từ BE commit
 * 2e9c4df). FE khớp BE 1-1 — xem QUYẾT ĐỊNH ở ORDER_STATUSES.
 */
describe("ORDER_TRANSITIONS (BE OrderStatus#canTransitionTo)", () => {
  it.each<[OrderStatus, OrderStatus[]]>([
    ["Draft", ["Pending Payment", "Cancelled"]],
    ["Pending Payment", ["Paid", "Cancelled"]],
    ["Paid", ["In Fulfilment", "On Hold", "Cancelled"]],
    ["In Fulfilment", ["Shipped", "On Hold", "Cancelled"]],
    ["On Hold", ["In Fulfilment", "Cancelled"]],
    ["Shipped", ["Delivered"]],
    ["Delivered", ["Completed", "Returned"]],
  ])("%s → %j", (from, to) => {
    expect(nextOrderStatuses(from)).toEqual(to);
  });

  it("BE BR-031; docs BR-03: từ Shipped trở đi không còn Cancelled", () => {
    for (const status of ["Shipped", "Delivered"] as const) {
      expect(nextOrderStatuses(status)).not.toContain("Cancelled");
    }
  });

  it("Completed / Cancelled / Returned là terminal (OrderStatus#isTerminal)", () => {
    for (const status of ["Completed", "Cancelled", "Returned"] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
      expect(isOrderTerminal(status)).toBe(true);
    }
  });

  it("bảng có đúng 10 trạng thái BE, không thêm trạng thái docs nào", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual(
      [
        "Cancelled",
        "Completed",
        "Delivered",
        "Draft",
        "In Fulfilment",
        "On Hold",
        "Paid",
        "Pending Payment",
        "Returned",
        "Shipped",
      ].sort(),
    );
  });
});

/**
 * Bộ mã quyền `sales-orders` theo seed BE (V20260903000100__identity_seed_roles_permissions.sql):
 * ORDER_COORDINATOR có APPROVE; SALES_STAFF chỉ VIEW_PAGE/READ/CREATE/UPDATE; WAREHOUSE_STAFF
 * không có quyền nào trên `sales-orders`.
 */
const ROLE_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  ORDER_COORDINATOR: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-orders:UPDATE",
    "sales-orders:APPROVE",
    "sales-orders:EXPORT",
  ],
  SALES_STAFF: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-orders:UPDATE",
  ],
  WAREHOUSE_STAFF: [],
};

function checkerFor(role: keyof typeof ROLE_PERMISSIONS) {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return (code: PermissionCode) => granted.includes(code);
}

const codes = (status: OrderStatus, role: keyof typeof ROLE_PERMISSIONS) =>
  allowedOrderActions(status, checkerFor(role)).map((a) => a.code);

describe("allowedOrderActions — action-gating theo status + mã quyền BE", () => {
  it("ORDER_COORDINATOR (có sales-orders:APPROVE) huỷ được đơn Pending Payment / Paid", () => {
    expect(codes("Pending Payment", "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
    expect(codes("Paid", "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
  });

  it("SALES_STAFF không có APPROVE → không thấy nút huỷ (BE sẽ trả 403)", () => {
    expect(codes("Pending Payment", "SALES_STAFF")).toEqual([]);
    expect(codes("Paid", "SALES_STAFF")).toEqual([]);
  });

  it("WAREHOUSE_STAFF không có quyền sales-orders → không thấy action nào", () => {
    expect(codes("Pending Payment", "WAREHOUSE_STAFF")).toEqual([]);
  });

  it("In Fulfilment (BE IN_FULFILMENT → CANCELLED) — ORDER_COORDINATOR thấy nút huỷ", () => {
    expect(codes("In Fulfilment", "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
  });

  it("On Hold (BE ON_HOLD → CANCELLED) — ORDER_COORDINATOR thấy nút huỷ", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
  });

  it("BE BR-031; docs BR-03: từ Shipped trở đi không ai thấy nút huỷ, kể cả có APPROVE", () => {
    for (const status of ["Shipped", "Delivered", "Completed", "Cancelled"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).toEqual([]);
    }
  });
});
