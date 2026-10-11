import { describe, expect, it } from "vitest";

import { ORDER_STATUSES } from "@/constants";

import {
  ORDER_TRANSITIONS,
  allowedOrderActions,
  isOrderTerminal,
  nextOrderStatuses,
} from "./lifecycle";

import type { OrderPaymentTerm } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { OrderStatus } from "./types";

/**
 * Nguồn: BE order/api/OrderStatus.java#canTransitionTo (develop, 12 giá trị sau
 * SCRUM-460/423/427). FE khớp BE 1-1 — xem QUYẾT ĐỊNH ở ORDER_STATUSES.
 */
describe("ORDER_TRANSITIONS (BE OrderStatus#canTransitionTo)", () => {
  it.each<[OrderStatus, OrderStatus[]]>([
    ["Draft", ["Pending Payment", "Confirmed", "On Hold", "Cancelled"]],
    ["Pending Payment", ["Confirmed", "Cancelled"]],
    ["Confirmed", ["In Production", "Ready to Fulfill", "In Fulfilment", "On Hold", "Cancelled"]],
    ["In Production", ["Ready to Fulfill", "On Hold", "Cancelled"]],
    ["Ready to Fulfill", ["In Fulfilment", "On Hold", "Cancelled"]],
    ["In Fulfilment", ["Shipped", "On Hold", "Cancelled"]],
    ["On Hold", ["Confirmed", "Pending Payment", "In Fulfilment", "Cancelled"]],
    ["Shipped", ["Delivered"]],
    ["Delivered", ["Completed", "Returned"]],
  ])("%s → %j", (from, to) => {
    expect(nextOrderStatuses(from)).toEqual(to);
  });

  it("docs 15 BR-02: Pending Payment không đi thẳng sang sản xuất / kho", () => {
    expect(nextOrderStatuses("Pending Payment")).not.toContain("In Production");
    expect(nextOrderStatuses("Pending Payment")).not.toContain("Ready to Fulfill");
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

  it("bảng phủ đúng 12 trạng thái BE, không thêm trạng thái docs nào", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(ORDER_STATUSES).toHaveLength(12);
    expect(ORDER_STATUSES).not.toContain("Paid");
  });
});

/**
 * Mã quyền theo seed BE develop:
 * - `sales-orders`: SALES_STAFF + ORDER_COORDINATOR VIEW_PAGE/READ/CREATE/UPDATE; chỉ
 *   ORDER_COORDINATOR có APPROVE (= release) — V20260903000100.
 * - `sales-order-cancellations:UPDATE`: SALES_STAFF + ORDER_COORDINATOR — V20261013000200.
 * - `sales-order-credit-holds`: ACCOUNTANT VIEW_PAGE/READ/APPROVE; Sales + Coordinator chỉ
 *   VIEW_PAGE/READ — V20261013000400.
 * - WAREHOUSE_STAFF: không có quyền đơn bán nào.
 */
const ROLE_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  ORDER_COORDINATOR: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:APPROVE",
    "sales-order-cancellations:UPDATE",
    "sales-order-credit-holds:READ",
  ],
  SALES_STAFF: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-order-cancellations:UPDATE",
    "sales-order-credit-holds:READ",
  ],
  ACCOUNTANT: ["sales-order-credit-holds:READ", "sales-order-credit-holds:APPROVE"],
  WAREHOUSE_STAFF: [],
};

type Role = keyof typeof ROLE_PERMISSIONS;

function checkerFor(role: Role) {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return (code: PermissionCode) => granted.includes(code);
}

const codes = (status: OrderStatus, role: Role, paymentTerm: OrderPaymentTerm = "PREPAID") =>
  allowedOrderActions(status, checkerFor(role), { paymentTerm }).map((a) => a.code);

describe("allowedOrderActions — release (SCRUM-423)", () => {
  it("Confirmed + ORDER_COORDINATOR → Release + Huỷ", () => {
    expect(codes("Confirmed", "ORDER_COORDINATOR")).toEqual(["release", "admin-cancel"]);
  });

  it("Confirmed + SALES_STAFF (không có APPROVE) → không thấy Release, vẫn huỷ được", () => {
    expect(codes("Confirmed", "SALES_STAFF")).toEqual(["admin-cancel"]);
  });

  it("docs 17 BR-02: chưa đủ điều kiện thanh toán (Pending Payment / On Hold) → không Release", () => {
    for (const status of ["Pending Payment", "On Hold", "Draft"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("release");
    }
  });

  it("đã release (In Production / Ready to Fulfill) → không Release lại", () => {
    for (const status of ["In Production", "Ready to Fulfill", "In Fulfilment"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("release");
    }
  });
});

describe("allowedOrderActions — credit hold (SCRUM-427, docs 14 BR-06)", () => {
  it("On Hold + CREDIT + ACCOUNTANT → Duyệt / Từ chối vượt hạn mức", () => {
    expect(codes("On Hold", "ACCOUNTANT", "CREDIT")).toEqual(["credit-approve", "credit-reject"]);
  });

  it("On Hold + CREDIT + ORDER_COORDINATOR (chỉ READ) → không duyệt được, chỉ huỷ", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", "CREDIT")).toEqual(["admin-cancel"]);
  });

  it("On Hold không phải đơn công nợ (treo vì lý do khác) → không có duyệt công nợ", () => {
    expect(codes("On Hold", "ACCOUNTANT", "DEPOSIT")).toEqual([]);
  });

  it("đơn CREDIT đã Confirmed → hết credit hold", () => {
    expect(codes("Confirmed", "ACCOUNTANT", "CREDIT")).toEqual([]);
  });
});

describe("allowedOrderActions — huỷ admin", () => {
  it("SALES_STAFF + ORDER_COORDINATOR có sales-order-cancellations:UPDATE → huỷ được trước Shipped", () => {
    for (const status of ["Pending Payment", "In Production", "Ready to Fulfill"] as const) {
      expect(codes(status, "SALES_STAFF")).toEqual(["admin-cancel"]);
      expect(codes(status, "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
    }
  });

  it("WAREHOUSE_STAFF không có quyền đơn bán → không thấy action nào", () => {
    for (const status of ORDER_STATUSES) expect(codes(status, "WAREHOUSE_STAFF")).toEqual([]);
  });

  it("BE BR-031; docs BR-03/BR-05: từ Shipped trở đi và terminal → không render nút mutating nào", () => {
    for (const status of ["Shipped", "Delivered", "Completed", "Cancelled", "Returned"] as const) {
      for (const role of Object.keys(ROLE_PERMISSIONS)) {
        expect(codes(status, role, "CREDIT")).toEqual([]);
      }
    }
  });
});
