import { describe, expect, it } from "vitest";

import { ORDER_STATUSES } from "@/constants";

import {
  ORDER_TRANSITIONS,
  allowedOrderActions,
  isManuallyResolvableHold,
  isOrderTerminal,
  isPackedOnlyAheadOfPrints,
  nextOrderStatuses,
  partialShipmentControl,
} from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { OrderActionContext } from "./lifecycle";
import type { OrderStatus } from "./types";

/**
 * Nguồn: BE order/api/OrderStatus.java#canTransitionTo (19 giá trị, BE PR #133; bảng cũng nằm ở DB
 * `ordering.order_status_transition`). FE khớp BE 1-1 — xem ORDER_STATUSES.
 */
describe("ORDER_TRANSITIONS (BE OrderStatus#canTransitionTo)", () => {
  it.each<[OrderStatus, OrderStatus[]]>([
    ["Draft", ["Pending Payment", "Confirmed", "On Hold", "Cancelled"]],
    ["Pending Payment", ["Confirmed", "Cancelled"]],
    ["Confirmed", ["In Production", "Ready to Fulfill", "On Hold", "Cancelled"]],
    ["In Production", ["Ready to Fulfill", "On Hold", "Cancelled"]],
    ["Ready to Fulfill", ["Picking", "Packed", "On Hold", "Cancelled"]],
    ["Picking", ["Packed", "Partially Fulfilled", "On Hold", "Cancelled"]],
    [
      "Partially Fulfilled",
      ["Packed", "Shipped", "Delivery Failed", "Delivered", "Returned", "On Hold"],
    ],
    ["Packed", ["Shipped", "Partially Fulfilled", "On Hold"]],
    [
      "On Hold",
      [
        "Confirmed",
        "Pending Payment",
        "In Production",
        "Ready to Fulfill",
        "Picking",
        "Partially Fulfilled",
        "Packed",
        "Cancelled",
      ],
    ],
    ["Shipped", ["Delivered", "Delivery Failed", "Partially Fulfilled"]],
    ["Delivery Failed", ["Delivered", "Returned", "Partially Fulfilled"]],
    ["Delivered", ["Completed", "Return Requested"]],
    ["Return Requested", ["Returned", "Delivered"]],
    ["Returned", ["Refunded", "Partially Refunded"]],
    ["Refunded", ["Closed"]],
    ["Partially Refunded", ["Closed"]],
    ["Completed", ["Closed"]],
  ])("%s → %j", (from, to) => {
    expect(nextOrderStatuses(from)).toEqual(to);
  });

  it("BR-ORD-004 (BE PR #133): từ Packed trở đi không còn Cancelled — đi luồng trả hàng", () => {
    for (const status of ["Packed", "Shipped", "Delivery Failed", "Delivered"] as const) {
      expect(nextOrderStatuses(status)).not.toContain("Cancelled");
    }
  });

  it("Cancelled / Closed / UNKNOWN không có chuyển tiếp (OrderStatus#isTerminal)", () => {
    for (const status of ["Cancelled", "Closed", "UNKNOWN"] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
      expect(isOrderTerminal(status)).toBe(true);
    }
  });

  it("bảng có đúng 19 trạng thái BE + UNKNOWN; không còn Paid / In Fulfilment", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(ORDER_STATUSES).toHaveLength(20);
    expect(ORDER_STATUSES).not.toContain("Paid");
    expect(ORDER_STATUSES).not.toContain("In Fulfilment");
  });

  it("mọi đích của bảng đều là trạng thái hợp lệ", () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });
});

/**
 * Quyền theo seed BE: ORDER_COORDINATOR có `sales-orders:APPROVE` (giữ / gỡ giữ / giao thất bại) và
 * `sales-order-cancellations:UPDATE` (huỷ, đóng phần còn lại); SALES_STAFF chỉ có cancellations:UPDATE;
 * WAREHOUSE_STAFF không có quyền nào trên đơn.
 */
const ROLE_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  ORDER_COORDINATOR: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-orders:UPDATE",
    "sales-orders:APPROVE",
    "sales-orders:EXPORT",
    "sales-order-cancellations:UPDATE",
  ],
  SALES_STAFF: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-orders:UPDATE",
    "sales-order-cancellations:UPDATE",
    // BE PR #150: SALES_STAFF (và SYSTEM_ADMIN) quyết đơn có giao một phần; điều phối viên thì không
    "sales-order-partial-shipments:UPDATE",
  ],
  WAREHOUSE_STAFF: [],
};

function checkerFor(role: keyof typeof ROLE_PERMISSIONS) {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return (code: PermissionCode) => granted.includes(code);
}

const codes = (
  status: OrderStatus,
  role: keyof typeof ROLE_PERMISSIONS,
  context?: Partial<OrderActionContext>,
) =>
  allowedOrderActions(status, checkerFor(role), {
    holdReason: null,
    hasShipments: false,
    packedAt: null,
    ...context,
  }).map((a) => a.code);

describe("allowedOrderActions — huỷ đơn (sales-order-cancellations:UPDATE)", () => {
  it.each([
    "Draft",
    "Pending Payment",
    "Confirmed",
    "In Production",
    "Ready to Fulfill",
    "Picking",
  ] as const)("%s → ORDER_COORDINATOR và SALES_STAFF thấy nút huỷ", (status) => {
    expect(codes(status, "ORDER_COORDINATOR")).toContain("admin-cancel");
    expect(codes(status, "SALES_STAFF")).toEqual(["admin-cancel"]);
  });

  it("On Hold (BE ON_HOLD → CANCELLED) — huỷ được", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).toContain(
      "admin-cancel",
    );
  });

  it("BE Order#requireNotPacked: đã có packedAt thì không huỷ, kể cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED", () => {
    const packedAt = "2026-09-08T01:00:00Z";
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "FRAUD", packedAt })).not.toContain(
      "admin-cancel",
    );
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "FRAUD" })).toContain(
      "admin-cancel",
    );
    // Giữ từ PICKING (chưa đóng gói xong) vẫn huỷ được; giữ khác vẫn gỡ được dù đã đóng gói
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "FRAUD", packedAt })).toContain(
      "resolve-hold",
    );
    expect(codes("Picking", "ORDER_COORDINATOR", { packedAt })).not.toContain("admin-cancel");
  });

  it("WAREHOUSE_STAFF không có quyền đơn → không thấy action nào", () => {
    expect(codes("Pending Payment", "WAREHOUSE_STAFF")).toEqual([]);
    expect(codes("Picking", "WAREHOUSE_STAFF")).toEqual([]);
  });

  it("BR-ORD-004: Packed trở đi không ai thấy nút huỷ, kể cả có quyền", () => {
    for (const status of [
      "Packed",
      "Shipped",
      "Delivery Failed",
      "Delivered",
      "Completed",
      "Closed",
      "Cancelled",
    ] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("admin-cancel");
    }
  });
});

describe("allowedOrderActions — Giữ đơn (sales-orders:APPROVE, mayBePutOnHold)", () => {
  it.each([
    "Confirmed",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
  ] as const)("%s → ORDER_COORDINATOR giữ được", (status) => {
    expect(codes(status, "ORDER_COORDINATOR")).toContain("hold");
  });

  it.each([
    "Draft",
    "Pending Payment",
    "On Hold",
    "Shipped",
    "Delivered",
    "Completed",
    "Closed",
  ] as const)("%s → không giữ được", (status) => {
    expect(codes(status, "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).not.toContain("hold");
  });

  it("SALES_STAFF (không có APPROVE) không thấy Giữ đơn", () => {
    expect(codes("Picking", "SALES_STAFF")).not.toContain("hold");
  });
});

describe("allowedOrderActions — Gỡ giữ", () => {
  it.each(["PAYMENT", "ADDRESS", "INVENTORY", "CUSTOMER", "FRAUD", "OTHER"] as const)(
    "giữ %s → ORDER_COORDINATOR gỡ được",
    (holdReason) => {
      expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason })).toContain("resolve-hold");
    },
  );

  it.each(["CREDIT", "DESIGN_MISMATCH", "UNKNOWN", null] as const)(
    "giữ %s → ẩn nút gỡ giữ (BE trả ORDER_CREDIT_HOLD_USE_APPROVAL / ORDER_DESIGN_HOLD_USE_REVERIFICATION)",
    (holdReason) => {
      expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason })).not.toContain("resolve-hold");
    },
  );

  it("SALES_STAFF không gỡ giữ được; đơn không ON_HOLD thì không có nút", () => {
    expect(codes("On Hold", "SALES_STAFF", { holdReason: "ADDRESS" })).not.toContain(
      "resolve-hold",
    );
    expect(codes("Picking", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).not.toContain(
      "resolve-hold",
    );
  });

  it("isManuallyResolvableHold: chỉ các lý do điều phối viên tự nêu", () => {
    expect(isManuallyResolvableHold("FRAUD")).toBe(true);
    expect(isManuallyResolvableHold("CREDIT")).toBe(false);
    expect(isManuallyResolvableHold("DESIGN_MISMATCH")).toBe(false);
    expect(isManuallyResolvableHold(null)).toBe(false);
  });
});

describe("allowedOrderActions — Ghi giao thất bại (APPROVE; SHIPPED / PARTIALLY_FULFILLED, đơn chưa chia lô)", () => {
  it("Shipped chưa chia lô → ORDER_COORDINATOR thấy", () => {
    expect(codes("Shipped", "ORDER_COORDINATOR")).toEqual(["delivery-failure"]);
  });

  it("đã chia lô → ẩn (BE 409 ORDER_DELIVERY_VIA_SHIPMENT)", () => {
    expect(codes("Shipped", "ORDER_COORDINATOR", { hasShipments: true })).toEqual([]);
  });

  it("trạng thái khác (Delivered, Packed, Delivery Failed) → không có", () => {
    for (const status of ["Delivered", "Packed", "Delivery Failed"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("delivery-failure");
    }
  });

  it("SALES_STAFF không có APPROVE → không thấy", () => {
    expect(codes("Shipped", "SALES_STAFF")).toEqual([]);
  });
});

describe("allowedOrderActions — Đóng phần còn lại (sales-order-cancellations:UPDATE, chỉ PARTIALLY_FULFILLED)", () => {
  it("Partially Fulfilled → ORDER_COORDINATOR có đủ giữ + đóng phần còn lại", () => {
    expect(codes("Partially Fulfilled", "ORDER_COORDINATOR", { hasShipments: true })).toEqual([
      "hold",
      "remainder-closure",
    ]);
  });

  it("SALES_STAFF (có cancellations:UPDATE) đóng được phần còn lại nhưng không giữ đơn", () => {
    expect(codes("Partially Fulfilled", "SALES_STAFF", { hasShipments: true })).toEqual([
      "remainder-closure",
    ]);
  });

  it("đơn ON_HOLD phải gỡ giữ trước; trạng thái khác không có nút", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).not.toContain(
      "remainder-closure",
    );
    expect(codes("Shipped", "ORDER_COORDINATOR")).not.toContain("remainder-closure");
  });
});

describe("allowedOrderActions — trạng thái lạ", () => {
  it("UNKNOWN → không thao tác nào", () => {
    expect(codes("UNKNOWN", "ORDER_COORDINATOR")).toEqual([]);
  });
});

describe("allowedOrderActions — huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150)", () => {
  const packedAt = "2026-10-22T01:00:00Z";

  it("IN_PRODUCTION đã đóng sẵn hàng có sẵn, chưa lô nào bàn giao → vẫn huỷ được (Order#packedOnlyAheadOfPrints)", () => {
    expect(codes("In Production", "ORDER_COORDINATOR", { packedAt })).toContain("admin-cancel");
    expect(codes("In Production", "SALES_STAFF", { packedAt })).toEqual(["admin-cancel"]);
  });

  it("đã có lô rời kho → phải đi luồng trả hàng, không huỷ", () => {
    expect(
      codes("In Production", "ORDER_COORDINATOR", { packedAt, hasShipments: true }),
    ).not.toContain("admin-cancel");
  });

  it("ON_HOLD giữ từ IN_PRODUCTION mà chưa lô nào đi → huỷ được; giữ từ PACKED → không", () => {
    expect(
      codes("On Hold", "ORDER_COORDINATOR", {
        holdReason: "FRAUD",
        packedAt,
        statusBeforeHold: "In Production",
      }),
    ).toContain("admin-cancel");
    expect(
      codes("On Hold", "ORDER_COORDINATOR", {
        holdReason: "FRAUD",
        packedAt,
        statusBeforeHold: "Packed",
      }),
    ).not.toContain("admin-cancel");
  });

  it("PACKED trở đi vẫn không huỷ được (ngoại lệ chỉ cho đơn còn đang in)", () => {
    expect(codes("Picking", "ORDER_COORDINATOR", { packedAt })).not.toContain("admin-cancel");
    expect(
      isPackedOnlyAheadOfPrints("Partially Fulfilled", {
        holdReason: null,
        hasShipments: false,
        packedAt,
      }),
    ).toBe(false);
  });
});

describe("partialShipmentControl — Giao một phần (sales-order-partial-shipments:UPDATE)", () => {
  const order = (
    status: OrderStatus,
    allowPartialShipment: boolean | null,
    printLinesReady: boolean | null = true,
  ) => ({ status, allowPartialShipment, printLinesReady });

  it("BE không trả cờ (dòng danh sách) → null, không đoán", () => {
    expect(partialShipmentControl(order("Picking", null), checkerFor("SALES_STAFF"))).toBeNull();
  });

  it("SALES_STAFF (có mã quyền) đổi được; nút đặt giá trị ngược với cờ hiện tại", () => {
    expect(partialShipmentControl(order("Picking", false), checkerFor("SALES_STAFF"))).toEqual({
      allowed: false,
      next: true,
      canChange: true,
      lock: null,
    });
    expect(partialShipmentControl(order("Picking", true), checkerFor("SALES_STAFF"))).toMatchObject(
      {
        allowed: true,
        next: false,
        canChange: true,
      },
    );
  });

  it("gate theo MÃ quyền: điều phối viên / kho không có mã → thấy trạng thái nhưng không đổi được", () => {
    expect(
      partialShipmentControl(order("Picking", false), checkerFor("ORDER_COORDINATOR")),
    ).toMatchObject({ allowed: false, canChange: false, lock: null });
    expect(
      partialShipmentControl(order("Picking", true), checkerFor("WAREHOUSE_STAFF")),
    ).toMatchObject({ canChange: false });
  });

  it.each([
    "Draft",
    "Pending Payment",
    "Confirmed",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
    "On Hold",
  ] as const)("%s → còn đổi được (BE Order#decidePartialShipment)", (status) => {
    expect(partialShipmentControl(order(status, false), checkerFor("SALES_STAFF"))).toMatchObject({
      canChange: true,
      lock: null,
    });
  });

  it.each([
    "Shipped",
    "Delivery Failed",
    "Delivered",
    "Return Requested",
    "Returned",
    "Refunded",
    "Partially Refunded",
    "Completed",
    "Cancelled",
    "Closed",
  ] as const)("%s → khoá (BE 409 ORDER_PARTIAL_SHIPMENT_LOCKED)", (status) => {
    expect(partialShipmentControl(order(status, true), checkerFor("SALES_STAFF"))).toMatchObject({
      canChange: false,
      lock: "closed",
    });
  });

  it("đang bật, đơn giao dở còn chờ hàng in (printLinesReady=false) → khoá 'awaiting-prints'; bật lại thì không", () => {
    expect(
      partialShipmentControl(order("Partially Fulfilled", true, false), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: false, lock: "awaiting-prints" });
    expect(
      partialShipmentControl(order("Partially Fulfilled", true, true), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: true, lock: null });
  });

  it("trạng thái chưa hỗ trợ → chỉ hiện cờ, không cho đổi, không bảo 'đã đóng'", () => {
    expect(partialShipmentControl(order("UNKNOWN", true), checkerFor("SALES_STAFF"))).toEqual({
      allowed: true,
      next: false,
      canChange: false,
      lock: null,
    });
  });
});
