import { describe, expect, it } from "vitest";

import { ORDER_READ_STATUSES, ORDER_STATUSES } from "@/constants";

import {
  ORDER_ACTIONS,
  ORDER_TRANSITIONS,
  allowedOrderActions,
  isCreditHold,
  isManuallyResolvableHold,
  isOrderTerminal,
  nextOrderStatuses,
  orderActionContextOf,
} from "./lifecycle";
import { isPackedOnlyAheadOfPrints } from "./partial-shipment";

import type { PermissionCode } from "@/lib/auth";
import type { OrderActionContext } from "./lifecycle";
import type { OrderReadStatus, OrderStatus } from "./types";

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
    ["Cancelled", []],
    ["Closed", []],
  ])("%s → %j", (from, to) => {
    expect(nextOrderStatuses(from)).toEqual(to);
  });

  it("docs 15 BR-02: Pending Payment không đi thẳng sang sản xuất / kho", () => {
    expect(nextOrderStatuses("Pending Payment")).not.toContain("In Production");
    expect(nextOrderStatuses("Pending Payment")).not.toContain("Ready to Fulfill");
  });

  it("BR-ORD-004 (BE PR #133): từ Packed trở đi không còn Cancelled — đi luồng trả hàng", () => {
    for (const status of ["Packed", "Shipped", "Delivery Failed", "Delivered"] as const) {
      expect(nextOrderStatuses(status)).not.toContain("Cancelled");
    }
  });

  it("Cancelled / Closed là terminal (OrderStatus#isTerminal); Completed còn → Closed", () => {
    for (const status of ["Cancelled", "Closed"] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
      expect(isOrderTerminal(status)).toBe(true);
    }
    expect(isOrderTerminal("Completed")).toBe(false);
  });

  it("bảng phủ đúng 19 trạng thái BE + UNKNOWN phòng thủ; không còn Paid / In Fulfilment", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_READ_STATUSES].sort());
    expect(ORDER_STATUSES).toHaveLength(19);
    expect(ORDER_STATUSES).not.toContain("Paid");
    expect(ORDER_STATUSES).not.toContain("In Fulfilment");
  });

  it("mọi đích của bảng đều là trạng thái đã biết", () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });

  it("UNKNOWN (trạng thái BE mới FE chưa hỗ trợ): không chuyển tiếp, KHÔNG phải terminal, không là đích", () => {
    expect(ORDER_TRANSITIONS.UNKNOWN).toEqual([]);
    expect(nextOrderStatuses("UNKNOWN")).toEqual([]);
    expect(isOrderTerminal("UNKNOWN")).toBe(false);
    for (const status of ORDER_STATUSES) expect(nextOrderStatuses(status)).not.toContain("UNKNOWN");
  });
});

/**
 * Mã quyền theo seed BE:
 * - `sales-orders`: SALES_STAFF + ORDER_COORDINATOR VIEW_PAGE/READ/CREATE/UPDATE; chỉ ORDER_COORDINATOR
 *   có APPROVE (= release, giữ / gỡ giữ / giao thất bại) — V20260903000100.
 * - `sales-order-cancellations:UPDATE` (huỷ, đóng phần còn lại): SALES_STAFF + ORDER_COORDINATOR —
 *   V20261013000200.
 * - `sales-order-credit-holds`: ACCOUNTANT VIEW_PAGE/READ/APPROVE; Sales + Coordinator chỉ
 *   VIEW_PAGE/READ — V20261013000400.
 * - WAREHOUSE_STAFF: không có quyền đơn bán nào.
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
    "sales-order-credit-holds:VIEW_PAGE",
    "sales-order-credit-holds:READ",
  ],
  SALES_STAFF: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-orders:UPDATE",
    "sales-order-cancellations:UPDATE",
    "sales-order-credit-holds:VIEW_PAGE",
    "sales-order-credit-holds:READ",
    // BE PR #150: SALES_STAFF (và SYSTEM_ADMIN) quyết đơn có giao một phần; điều phối viên thì không
    "sales-order-partial-shipments:UPDATE",
  ],
  ACCOUNTANT: [
    "sales-order-credit-holds:VIEW_PAGE",
    "sales-order-credit-holds:READ",
    "sales-order-credit-holds:APPROVE",
  ],
  WAREHOUSE_STAFF: [],
};

type Role = keyof typeof ROLE_PERMISSIONS;

function checkerFor(role: Role) {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return (code: PermissionCode) => granted.includes(code);
}

/** Đơn chi tiết điển hình: trả trước, không giữ, chưa chia lô, chưa đóng gói. */
const BASE_CONTEXT: OrderActionContext = {
  paymentTerm: "PREPAID",
  holdReason: null,
  hasShipments: false,
  packedAt: null,
  statusBeforeHold: null,
};

const codes = (status: OrderReadStatus, role: Role, context?: Partial<OrderActionContext>) =>
  allowedOrderActions(status, checkerFor(role), { ...BASE_CONTEXT, ...context }).map((a) => a.code);

const PACKED_AT = "2026-09-08T01:00:00Z";
const CREDIT_HOLD = { paymentTerm: "CREDIT", holdReason: "CREDIT" } as const;

describe("allowedOrderActions — release (SCRUM-423)", () => {
  it("Confirmed + ORDER_COORDINATOR → Release + Huỷ + Giữ", () => {
    expect(codes("Confirmed", "ORDER_COORDINATOR")).toEqual(["release", "admin-cancel", "hold"]);
  });

  it("Confirmed + SALES_STAFF (không có APPROVE) → không thấy Release, vẫn huỷ được", () => {
    expect(codes("Confirmed", "SALES_STAFF")).toEqual(["admin-cancel"]);
  });

  it("hai đích BE có thể chọn (có dòng in → In Production, chỉ hàng sẵn → Ready to Fulfill)", () => {
    const release = ORDER_ACTIONS.find((action) => action.code === "release");
    expect(release?.outcome).toEqual({
      kind: "to",
      statuses: ["In Production", "Ready to Fulfill"],
    });
    // Đơn công nợ cũng release được trên FE: nợ quá hạn / mẫu duyệt / kho là điều kiện server
    expect(codes("Confirmed", "ORDER_COORDINATOR", { paymentTerm: "CREDIT" })).toContain("release");
  });

  it("docs 17 BR-02: chưa đủ điều kiện thanh toán (Pending Payment / On Hold / Draft) → không Release", () => {
    for (const status of ["Pending Payment", "On Hold", "Draft"] as const) {
      expect(codes(status, "ORDER_COORDINATOR", CREDIT_HOLD)).not.toContain("release");
    }
  });

  it("đã release (In Production / Ready to Fulfill / Picking) → không Release lại", () => {
    for (const status of ["In Production", "Ready to Fulfill", "Picking"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("release");
    }
  });
});

describe("allowedOrderActions — credit hold (SCRUM-427, docs 14 BR-06)", () => {
  it("giữ công nợ thật (On Hold + CREDIT + lý do CREDIT) + ACCOUNTANT → Duyệt / Từ chối", () => {
    expect(codes("On Hold", "ACCOUNTANT", CREDIT_HOLD)).toEqual([
      "credit-approve",
      "credit-reject",
    ]);
  });

  it("giữ công nợ + ORDER_COORDINATOR (chỉ READ) → không duyệt, không gỡ tay, chỉ huỷ", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", CREDIT_HOLD)).toEqual(["admin-cancel"]);
  });

  it.each(["ADDRESS", "DESIGN_MISMATCH", "FRAUD", "UNKNOWN", null] as const)(
    "đơn CREDIT giữ vì %s → KHÔNG có duyệt / từ chối công nợ (BE ORDER_NOT_ON_CREDIT_HOLD)",
    (holdReason) => {
      const actions = codes("On Hold", "ACCOUNTANT", { paymentTerm: "CREDIT", holdReason });
      expect(actions).not.toContain("credit-approve");
      expect(actions).not.toContain("credit-reject");
    },
  );

  it("lý do CREDIT nhưng phương thức không phải / chưa biết là CREDIT → không duyệt (BE requireCreditHold)", () => {
    for (const paymentTerm of ["DEPOSIT", null, undefined] as const) {
      expect(codes("On Hold", "ACCOUNTANT", { paymentTerm, holdReason: "CREDIT" })).toEqual([]);
    }
  });

  it("đơn CREDIT đã Confirmed → hết credit hold", () => {
    expect(codes("Confirmed", "ACCOUNTANT", { paymentTerm: "CREDIT" })).toEqual([]);
  });

  it("isCreditHold cần cả lý do CREDIT lẫn phương thức CREDIT", () => {
    expect(isCreditHold({ holdReason: "CREDIT", paymentTerm: "CREDIT" })).toBe(true);
    expect(isCreditHold({ holdReason: "ADDRESS", paymentTerm: "CREDIT" })).toBe(false);
    expect(isCreditHold({ holdReason: "CREDIT", paymentTerm: "PREPAID" })).toBe(false);
  });
});

describe("allowedOrderActions — huỷ admin (sales-order-cancellations:UPDATE)", () => {
  it.each([
    "Draft",
    "Pending Payment",
    "Confirmed",
    "In Production",
    "Ready to Fulfill",
    "Picking",
  ] as const)("%s chưa đóng gói → ORDER_COORDINATOR và SALES_STAFF thấy nút huỷ", (status) => {
    expect(codes(status, "ORDER_COORDINATOR")).toContain("admin-cancel");
    expect(codes(status, "SALES_STAFF")).toEqual(["admin-cancel"]);
  });

  it("On Hold chưa đóng gói (BE ON_HOLD → CANCELLED) — huỷ được", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).toContain(
      "admin-cancel",
    );
  });

  it("BE Order#requireNotPacked: đã có packedAt thì không huỷ, kể cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED", () => {
    expect(
      codes("On Hold", "ORDER_COORDINATOR", { holdReason: "FRAUD", packedAt: PACKED_AT }),
    ).not.toContain("admin-cancel");
    // Giữ khác vẫn gỡ được dù đã đóng gói
    expect(
      codes("On Hold", "ORDER_COORDINATOR", { holdReason: "FRAUD", packedAt: PACKED_AT }),
    ).toContain("resolve-hold");
    expect(codes("Picking", "ORDER_COORDINATOR", { packedAt: PACKED_AT })).not.toContain(
      "admin-cancel",
    );
  });

  it("chưa biết lịch sử đóng gói (packedAt undefined) → không mở nút huỷ", () => {
    expect(codes("Confirmed", "ORDER_COORDINATOR", { packedAt: undefined })).not.toContain(
      "admin-cancel",
    );
  });

  it("BR-ORD-004: Packed trở đi không ai thấy nút huỷ, kể cả có quyền", () => {
    for (const status of [
      "Packed",
      "Partially Fulfilled",
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

  it("WAREHOUSE_STAFF không có quyền đơn → không thấy action nào ở bất kỳ trạng thái", () => {
    for (const status of ORDER_STATUSES) {
      expect(codes(status, "WAREHOUSE_STAFF", { ...CREDIT_HOLD, holdReason: "ADDRESS" })).toEqual(
        [],
      );
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
    "giữ %s → ORDER_COORDINATOR gỡ được; đích = trạng thái đã lưu (không cố định)",
    (holdReason) => {
      expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason })).toContain("resolve-hold");
    },
  );

  it.each(["CREDIT", "DESIGN_MISMATCH", "UNKNOWN", null, undefined] as const)(
    "giữ %s → ẩn nút gỡ giữ (BE ORDER_CREDIT_HOLD_USE_APPROVAL / ORDER_DESIGN_HOLD_USE_REVERIFICATION / không đoán)",
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

  it("đích là trạng thái trước khi giữ, không phải một trạng thái gõ cứng", () => {
    const resolve = ORDER_ACTIONS.find((action) => action.code === "resolve-hold");
    expect(resolve?.outcome).toEqual({ kind: "restore-before-hold" });
  });

  it("isManuallyResolvableHold: chỉ các lý do điều phối viên tự nêu", () => {
    expect(isManuallyResolvableHold("FRAUD")).toBe(true);
    expect(isManuallyResolvableHold("CREDIT")).toBe(false);
    expect(isManuallyResolvableHold("DESIGN_MISMATCH")).toBe(false);
    expect(isManuallyResolvableHold("UNKNOWN")).toBe(false);
    expect(isManuallyResolvableHold(null)).toBe(false);
    expect(isManuallyResolvableHold(undefined)).toBe(false);
  });
});

describe("allowedOrderActions — Ghi giao thất bại (APPROVE; SHIPPED / PARTIALLY_FULFILLED, đơn chưa chia lô)", () => {
  it("Shipped chưa chia lô → ORDER_COORDINATOR thấy", () => {
    expect(codes("Shipped", "ORDER_COORDINATOR")).toEqual(["delivery-failure"]);
  });

  it("đã chia lô → ẩn (BE 409 ORDER_DELIVERY_VIA_SHIPMENT); chưa biết có lô hay không → ẩn", () => {
    expect(codes("Shipped", "ORDER_COORDINATOR", { hasShipments: true })).toEqual([]);
    expect(codes("Shipped", "ORDER_COORDINATOR", { hasShipments: undefined })).toEqual([]);
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
    expect(
      codes("Partially Fulfilled", "ORDER_COORDINATOR", {
        hasShipments: true,
        packedAt: PACKED_AT,
      }),
    ).toEqual(["hold", "remainder-closure"]);
  });

  it("SALES_STAFF (có cancellations:UPDATE) đóng được phần còn lại nhưng không giữ đơn", () => {
    expect(
      codes("Partially Fulfilled", "SALES_STAFF", { hasShipments: true, packedAt: PACKED_AT }),
    ).toEqual(["remainder-closure"]);
  });

  it("đơn ON_HOLD phải gỡ giữ trước; trạng thái khác không có nút", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).not.toContain(
      "remainder-closure",
    );
    expect(codes("Shipped", "ORDER_COORDINATOR")).not.toContain("remainder-closure");
  });

  it("đích theo các lô giao — không ép một trạng thái", () => {
    const closure = ORDER_ACTIONS.find((action) => action.code === "remainder-closure");
    expect(closure?.outcome).toEqual({
      kind: "follow-shipments",
      possible: ["Shipped", "Delivery Failed", "Delivered", "Returned"],
    });
  });
});

describe("allowedOrderActions — trạng thái lạ + định nghĩa action", () => {
  it("UNKNOWN → không action nào kể cả khi có mọi quyền và mọi ngữ cảnh", () => {
    const all = () => true;
    expect(allowedOrderActions("UNKNOWN", all, BASE_CONTEXT)).toEqual([]);
    expect(allowedOrderActions("UNKNOWN", all, { ...BASE_CONTEXT, ...CREDIT_HOLD })).toEqual([]);
  });

  it("đủ 8 action; mọi trạng thái nguồn / đích là trạng thái đã biết (không Paid / In Fulfilment)", () => {
    expect(ORDER_ACTIONS.map((action) => action.code)).toEqual([
      "release",
      "credit-approve",
      "credit-reject",
      "admin-cancel",
      "hold",
      "resolve-hold",
      "delivery-failure",
      "remainder-closure",
    ]);
    for (const action of ORDER_ACTIONS) {
      const targets =
        action.outcome.kind === "to"
          ? action.outcome.statuses
          : action.outcome.kind === "follow-shipments"
            ? action.outcome.possible
            : [];
      for (const status of [...action.fromStatuses, ...targets]) {
        expect(ORDER_STATUSES).toContain(status);
      }
    }
  });

  it("mọi đích tĩnh là cạnh hợp lệ từ mọi trạng thái nguồn của action", () => {
    for (const action of ORDER_ACTIONS) {
      if (action.outcome.kind === "restore-before-hold") continue;
      const targets =
        action.outcome.kind === "to" ? action.outcome.statuses : action.outcome.possible;
      for (const from of action.fromStatuses) {
        for (const to of targets) expect(nextOrderStatuses(from)).toContain(to);
      }
    }
  });

  it("orderActionContextOf dựng ngữ cảnh từ đơn chi tiết", () => {
    expect(
      orderActionContextOf({
        paymentTerm: "CREDIT",
        holdReason: "CREDIT",
        shipments: [],
        packedAt: null,
        statusBeforeHold: null,
      }),
    ).toEqual({
      paymentTerm: "CREDIT",
      holdReason: "CREDIT",
      hasShipments: false,
      packedAt: null,
      statusBeforeHold: null,
    });
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
      isPackedOnlyAheadOfPrints("Partially Fulfilled", { hasShipments: false, packedAt }),
    ).toBe(false);
  });
});
