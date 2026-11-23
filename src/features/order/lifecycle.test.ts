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
 * Nguồn: BE order/api/OrderStatus.java#canTransitionTo (21 giá trị gồm PENDING_CONTRACT / AWAITING_STOCK, BE PR #133; bảng cũng nằm ở DB
 * `ordering.order_status_transition`). FE khớp BE 1-1 — xem ORDER_STATUSES.
 */
describe("ORDER_TRANSITIONS (BE OrderStatus#canTransitionTo)", () => {
  it.each<[OrderStatus, OrderStatus[]]>([
    ["Draft", ["Pending Contract", "Cancelled"]],
    ["Pending Contract", ["Draft", "Pending Payment", "Confirmed", "On Hold", "Cancelled"]],
    ["Pending Payment", ["Confirmed", "Cancelled"]],
    ["Confirmed", ["Awaiting Stock", "In Production", "Ready to Fulfill", "On Hold", "Cancelled"]],
    ["Awaiting Stock", ["Ready to Fulfill", "Partially Fulfilled", "On Hold", "Cancelled"]],
    ["In Production", ["Ready to Fulfill", "Partially Fulfilled", "On Hold", "Cancelled"]],
    ["Ready to Fulfill", ["Picking", "Packed", "Partially Fulfilled", "On Hold", "Cancelled"]],
    ["Picking", ["Packed", "Partially Fulfilled", "On Hold", "Cancelled"]],
    [
      "Partially Fulfilled",
      [
        "Packed",
        "Shipped",
        "Delivery Failed",
        "Delivered",
        "Returned",
        "On Hold",
        "Partially Refunded",
        "Closed",
      ],
    ],
    ["Packed", ["Shipped", "Partially Fulfilled", "On Hold"]],
    [
      "On Hold",
      [
        "Confirmed",
        "Pending Payment",
        "Awaiting Stock",
        "In Production",
        "Ready to Fulfill",
        "Picking",
        "Partially Fulfilled",
        "Packed",
        "Cancelled",
      ],
    ],
    ["Shipped", ["Delivered", "Delivery Failed", "Partially Fulfilled", "On Hold"]],
    ["Delivery Failed", ["Delivered", "Returned", "Partially Fulfilled", "On Hold"]],
    ["Delivered", ["Completed", "Return Requested", "Delivery Failed"]],
    [
      "Return Requested",
      [
        "Returned",
        "Delivered",
        "Completed",
        "Refunded",
        "Partially Refunded",
        "Delivery Failed",
        "Partially Fulfilled",
      ],
    ],
    [
      "Returned",
      [
        "Refunded",
        "Partially Refunded",
        "Delivered",
        "Completed",
        "Delivery Failed",
        "Partially Fulfilled",
        "Closed",
      ],
    ],
    ["Refunded", ["Closed", "Return Requested", "Returned"]],
    ["Partially Refunded", ["Closed", "Return Requested", "Returned", "Partially Fulfilled"]],
    ["Completed", ["Closed", "Return Requested"]],
    ["Cancelled", []],
    ["Closed", []],
  ])("%s → %j", (from, to) => {
    expect(nextOrderStatuses(from)).toEqual(to);
  });

  it("WF-05 BO-06: cạnh mới của G1 — trả hàng kết thúc không hoàn tiền (X-8), rút yêu cầu về trạng thái gốc (F-8, BE-40)", () => {
    expect(nextOrderStatuses("Returned")).toEqual(
      expect.arrayContaining(["Delivered", "Completed"]),
    );
    expect(nextOrderStatuses("Return Requested")).toEqual(
      expect.arrayContaining(["Completed", "Refunded", "Partially Refunded"]),
    );
    // Hoàn tiền bị huỷ (TT-4) và lô hoàn về một phần (RTM-RETURNED-PARTIAL)
    expect(nextOrderStatuses("Refunded")).toContain("Returned");
    expect(nextOrderStatuses("Partially Refunded")).toEqual(
      expect.arrayContaining(["Returned", "Partially Fulfilled"]),
    );
    expect(nextOrderStatuses("Partially Fulfilled")).toContain("Partially Refunded");
  });

  it("audit r2 M-6 (BE-45, settlement V20261223000100): hãng chở về / thất lạc, không gì phải hoàn → đóng thẳng, không qua “hoàn một phần”", () => {
    expect(nextOrderStatuses("Returned")).toContain("Closed");
    expect(nextOrderStatuses("Partially Fulfilled")).toContain("Closed");
    // BE-46: khiếu nại kết thúc không hoàn gì trên đơn giao thất bại / giao một phần → về đường giao
    expect(nextOrderStatuses("Return Requested")).toEqual(
      expect.arrayContaining(["Delivery Failed", "Partially Fulfilled"]),
    );
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

  it("bảng phủ đúng 21 trạng thái BE + UNKNOWN phòng thủ; không còn Paid / In Fulfilment", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_READ_STATUSES].sort());
    expect(ORDER_STATUSES).toHaveLength(21);
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
 * - `sales-orders`: SALES_STAFF + ORDER_COORDINATOR VIEW_PAGE/READ/CREATE/UPDATE. `sales-orders:APPROVE` BE đã xoá
 *   (V20261115000200): giữ / gỡ giữ là `sales-order-holds:UPDATE` (SALES_STAFF + SYSTEM_ADMIN, docs 17 §4.9); ghi giao
 *   thất bại cấp đơn là `fulfillment-delivery-outcomes:APPROVE` (quản lý kho); release là `sales-order-releases:UPDATE`
 *   cho WAREHOUSE_MANAGER (kho xuất, docs 17 BR-03).
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
    // docs 17 §4.9: Sales giữ / gỡ giữ đơn (trừ giữ công nợ)
    "sales-order-holds:UPDATE",
    "sales-order-credit-holds:VIEW_PAGE",
    "sales-order-credit-holds:READ",
    // BE PR #150: SALES_STAFF (và SYSTEM_ADMIN) quyết đơn có giao một phần; điều phối viên thì không
    "sales-order-partial-shipments:UPDATE",
  ],
  // BE V20261115000200: quản lý kho đọc đơn + release (kho của mình); không huỷ / giữ
  WAREHOUSE_MANAGER: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-order-releases:UPDATE",
    "fulfillment-delivery-outcomes:APPROVE",
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
  holdReason: null,
  hasShipments: false,
  packedAt: null,
  firstLabeledAt: null,
  statusBeforeHold: null,
};

const codes = (status: OrderReadStatus, role: Role, context?: Partial<OrderActionContext>) =>
  allowedOrderActions(status, checkerFor(role), { ...BASE_CONTEXT, ...context }).map((a) => a.code);

const PACKED_AT = "2026-09-08T01:00:00Z";
const CREDIT_HOLD = { holdReason: "CREDIT" } as const;

describe("allowedOrderActions — release (docs 17 §4.2 bước 5, BR-03; sales-order-releases:UPDATE)", () => {
  it("Confirmed + quản lý kho (sales-order-releases:UPDATE) → chỉ Release (không huỷ, không giữ)", () => {
    expect(codes("Confirmed", "WAREHOUSE_MANAGER")).toEqual(["release"]);
  });

  it("Confirmed + ORDER_COORDINATOR (không có sales-order-releases:UPDATE) → KHÔNG Release; chỉ huỷ theo mã của nó", () => {
    expect(codes("Confirmed", "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
  });

  it("Confirmed + SALES_STAFF / kế toán / NV kho → không thấy Release (Sales giữ + huỷ theo mã của chúng)", () => {
    expect(codes("Confirmed", "SALES_STAFF")).toEqual(["admin-cancel", "hold"]);
    expect(codes("Confirmed", "ACCOUNTANT")).toEqual([]);
    expect(codes("Confirmed", "WAREHOUSE_STAFF")).toEqual([]);
  });

  it("đích của Release là Ready to Fulfill (không còn In Production — in ấn làm ngoài hệ thống)", () => {
    const release = ORDER_ACTIONS.find((action) => action.code === "release");
    expect(release?.permission).toBe("sales-order-releases:UPDATE");
    expect(release?.outcome).toEqual({
      kind: "to",
      statuses: ["Ready to Fulfill"],
      stayIn: ["Partially Fulfilled"],
    });
    // Đơn công nợ cũng release được trên FE: nợ quá hạn / giữ đủ hàng / kho là điều kiện server
    expect(codes("Confirmed", "WAREHOUSE_MANAGER")).toContain("release");
  });

  // BE Order#release (CONFIRMED, hoặc AWAITING_STOCK) + Order#releaseLaterBatch (PARTIALLY_FULFILLED) — docs 17 §4.2 / §4.4 / §4.5
  it("trạng thái cho Release đúng bằng BE: Confirmed, Awaiting Stock, Partially Fulfilled — không hơn", () => {
    const release = ORDER_ACTIONS.find((action) => action.code === "release");
    expect(release?.fromStatuses).toEqual(["Confirmed", "Awaiting Stock", "Partially Fulfilled"]);
    const releasable = ORDER_STATUSES.filter((status) =>
      codes(status, "WAREHOUSE_MANAGER").includes("release"),
    );
    expect(releasable).toEqual(["Confirmed", "Awaiting Stock", "Partially Fulfilled"]);
  });

  it("Awaiting Stock (đã giữ đủ thùng của đợt kế tiếp) + quản lý kho → Release, chuyển Ready to Fulfill", () => {
    expect(codes("Awaiting Stock", "WAREHOUSE_MANAGER")).toEqual(["release"]);
    expect(nextOrderStatuses("Awaiting Stock")).toContain("Ready to Fulfill");
  });

  it("Partially Fulfilled (đợt giao sau) + quản lý kho → Release, đơn giữ nguyên trạng thái (stayIn)", () => {
    // Quản lý kho còn fulfillment-delivery-outcomes:APPROVE nhưng đơn đã chia lô → không có "giao thất bại" ở cấp đơn
    expect(codes("Partially Fulfilled", "WAREHOUSE_MANAGER", { hasShipments: true })).toEqual([
      "release",
    ]);
    // Partially Fulfilled → Ready to Fulfill KHÔNG phải cạnh của BE; Release hợp lệ nhờ `stayIn`, không phải nhờ cạnh
    expect(nextOrderStatuses("Partially Fulfilled")).not.toContain("Ready to Fulfill");
    const release = ORDER_ACTIONS.find((action) => action.code === "release");
    expect(release?.outcome).toMatchObject({ kind: "to", stayIn: ["Partially Fulfilled"] });
  });

  it("Awaiting Stock / Partially Fulfilled không có sales-order-releases:UPDATE → không Release", () => {
    for (const status of ["Awaiting Stock", "Partially Fulfilled"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).not.toContain("release");
      expect(codes(status, "SALES_STAFF")).not.toContain("release");
      expect(codes(status, "WAREHOUSE_STAFF")).not.toContain("release");
    }
  });

  it("Pending Contract (chưa ký hợp đồng) → không Release dù có quyền", () => {
    expect(codes("Pending Contract", "WAREHOUSE_MANAGER")).not.toContain("release");
  });

  it("docs 17 BR-02: chưa đủ điều kiện thanh toán (Pending Payment / On Hold / Draft) → không Release", () => {
    for (const status of ["Pending Payment", "On Hold", "Draft"] as const) {
      expect(codes(status, "WAREHOUSE_MANAGER", CREDIT_HOLD)).not.toContain("release");
    }
  });

  it("đã release (In Production / Ready to Fulfill / Picking) → không Release lại", () => {
    for (const status of ["In Production", "Ready to Fulfill", "Picking"] as const) {
      expect(codes(status, "WAREHOUSE_MANAGER")).not.toContain("release");
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
    "đơn giữ vì %s → KHÔNG có duyệt / từ chối công nợ (BE ORDER_NOT_ON_CREDIT_HOLD)",
    (holdReason) => {
      const actions = codes("On Hold", "ACCOUNTANT", { holdReason });
      expect(actions).not.toContain("credit-approve");
      expect(actions).not.toContain("credit-reject");
    },
  );

  it("TT-1: BE không còn gửi paymentTerm — chỉ lý do giữ CREDIT là đủ để Kế toán thấy duyệt / từ chối", () => {
    expect(codes("On Hold", "ACCOUNTANT", { holdReason: "CREDIT" })).toEqual([
      "credit-approve",
      "credit-reject",
    ]);
  });

  it("lý do giữ chưa biết (dòng danh sách không mang field) → không duyệt", () => {
    expect(codes("On Hold", "ACCOUNTANT", { holdReason: undefined })).toEqual([]);
  });

  it("đơn đã Confirmed → hết credit hold", () => {
    expect(codes("Confirmed", "ACCOUNTANT", { holdReason: null })).toEqual([]);
  });

  it("isCreditHold chỉ xét lý do giữ CREDIT (BE Order#requireCreditHold)", () => {
    expect(isCreditHold({ holdReason: "CREDIT" })).toBe(true);
    expect(isCreditHold({ holdReason: "ADDRESS" })).toBe(false);
    expect(isCreditHold({ holdReason: null })).toBe(false);
    expect(isCreditHold({ holdReason: undefined })).toBe(false);
  });
});

describe("allowedOrderActions — huỷ admin (sales-order-cancellations:UPDATE)", () => {
  it.each([
    "Draft",
    "Pending Payment",
    "Pending Contract",
    "Confirmed",
    "Awaiting Stock",
    "In Production",
    "Ready to Fulfill",
    "Picking",
  ] as const)("%s chưa đóng gói → ORDER_COORDINATOR và SALES_STAFF thấy nút huỷ", (status) => {
    expect(codes(status, "ORDER_COORDINATOR")).toContain("admin-cancel");
    expect(codes(status, "SALES_STAFF")).toContain("admin-cancel");
    expect(codes(status, "ORDER_COORDINATOR")).toEqual(["admin-cancel"]);
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
    // Giữ khác vẫn gỡ được dù đã đóng gói (Sales: sales-order-holds:UPDATE)
    expect(codes("On Hold", "SALES_STAFF", { holdReason: "FRAUD", packedAt: PACKED_AT })).toContain(
      "resolve-hold",
    );
    expect(codes("Picking", "ORDER_COORDINATOR", { packedAt: PACKED_AT })).not.toContain(
      "admin-cancel",
    );
  });

  it("BE PR #317 (WF4 BE-8): đã có firstLabeledAt (thùng đầu tiên dán nhãn) thì ẩn nút huỷ ở mọi trạng thái huỷ được, kể cả khi chưa có packedAt; chưa biết (undefined) cũng ẩn", () => {
    const labeled = { firstLabeledAt: "2026-11-10T02:00:00Z" };
    for (const status of ["Confirmed", "In Production", "Ready to Fulfill", "Picking"] as const) {
      expect(codes(status, "ORDER_COORDINATOR")).toContain("admin-cancel");
      expect(codes(status, "ORDER_COORDINATOR", labeled)).not.toContain("admin-cancel");
      expect(codes(status, "ORDER_COORDINATOR", { firstLabeledAt: undefined })).not.toContain(
        "admin-cancel",
      );
    }
    expect(
      codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS", ...labeled }),
    ).not.toContain("admin-cancel");
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

describe("allowedOrderActions — Giữ đơn (sales-order-holds:UPDATE, mayBePutOnHold)", () => {
  it.each([
    "Confirmed",
    "Awaiting Stock",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
  ] as const)("%s → SALES_STAFF giữ được", (status) => {
    expect(codes(status, "SALES_STAFF")).toContain("hold");
  });

  it.each([
    "Draft",
    "Pending Contract",
    "Pending Payment",
    "On Hold",
    "Shipped",
    "Delivered",
    "Completed",
    "Closed",
  ] as const)("%s → không giữ được", (status) => {
    expect(codes(status, "SALES_STAFF", { holdReason: "ADDRESS" })).not.toContain("hold");
  });

  it("ORDER_COORDINATOR / quản lý kho / kế toán (không có sales-order-holds:UPDATE) không thấy Giữ đơn", () => {
    for (const role of ["ORDER_COORDINATOR", "WAREHOUSE_MANAGER", "ACCOUNTANT"] as const) {
      expect(codes("Picking", role)).not.toContain("hold");
    }
  });

  it("đúng mã BE dùng: sales-order-holds:UPDATE (Sales giữ đơn ON_HOLD INVENTORY của ca SO-…38 thì gỡ được)", () => {
    for (const code of ["hold", "resolve-hold"] as const) {
      expect(ORDER_ACTIONS.find((action) => action.code === code)?.permission).toBe(
        "sales-order-holds:UPDATE",
      );
    }
  });
});

describe("allowedOrderActions — Gỡ giữ", () => {
  it.each(["PAYMENT", "ADDRESS", "INVENTORY", "CUSTOMER", "FRAUD", "OTHER"] as const)(
    "giữ %s → SALES_STAFF gỡ được; đích = trạng thái đã lưu (không cố định)",
    (holdReason) => {
      expect(codes("On Hold", "SALES_STAFF", { holdReason })).toContain("resolve-hold");
    },
  );

  it.each(["CREDIT", "DESIGN_MISMATCH", "UNKNOWN", null, undefined] as const)(
    "giữ %s → ẩn nút gỡ giữ (BE ORDER_CREDIT_HOLD_USE_APPROVAL / mã cũ / không đoán)",
    (holdReason) => {
      expect(codes("On Hold", "SALES_STAFF", { holdReason })).not.toContain("resolve-hold");
    },
  );

  it("ORDER_COORDINATOR không gỡ giữ được; đơn không ON_HOLD thì không có nút", () => {
    expect(codes("On Hold", "ORDER_COORDINATOR", { holdReason: "ADDRESS" })).not.toContain(
      "resolve-hold",
    );
    expect(codes("Picking", "SALES_STAFF", { holdReason: "ADDRESS" })).not.toContain(
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

describe("allowedOrderActions — Ghi giao thất bại (fulfillment-delivery-outcomes:APPROVE; SHIPPED / PARTIALLY_FULFILLED, đơn chưa chia lô)", () => {
  it("Shipped chưa chia lô → quản lý kho (fulfillment-delivery-outcomes:APPROVE) thấy", () => {
    expect(codes("Shipped", "WAREHOUSE_MANAGER")).toEqual(["delivery-failure"]);
  });

  it("đã chia lô → ẩn (BE 409 ORDER_DELIVERY_VIA_SHIPMENT); chưa biết có lô hay không → ẩn", () => {
    expect(codes("Shipped", "WAREHOUSE_MANAGER", { hasShipments: true })).toEqual([]);
    expect(codes("Shipped", "WAREHOUSE_MANAGER", { hasShipments: undefined })).toEqual([]);
  });

  it("trạng thái khác (Delivered, Packed, Delivery Failed) → không có", () => {
    for (const status of ["Delivered", "Packed", "Delivery Failed"] as const) {
      expect(codes(status, "WAREHOUSE_MANAGER")).not.toContain("delivery-failure");
    }
  });

  it("SALES_STAFF / điều phối không có fulfillment-delivery-outcomes:APPROVE → không thấy", () => {
    expect(codes("Shipped", "ORDER_COORDINATOR")).toEqual([]);
    expect(codes("Shipped", "SALES_STAFF")).toEqual([]);
  });
});

describe("allowedOrderActions — Đóng phần còn lại (sales-order-cancellations:UPDATE, chỉ PARTIALLY_FULFILLED)", () => {
  it("Partially Fulfilled → SALES_STAFF có đủ giữ + đóng phần còn lại", () => {
    expect(
      codes("Partially Fulfilled", "SALES_STAFF", {
        hasShipments: true,
        packedAt: PACKED_AT,
      }),
    ).toEqual(["hold", "remainder-closure"]);
  });

  it("ORDER_COORDINATOR (có cancellations:UPDATE, không có holds:UPDATE) đóng được phần còn lại nhưng không giữ đơn", () => {
    expect(
      codes("Partially Fulfilled", "ORDER_COORDINATOR", {
        hasShipments: true,
        packedAt: PACKED_AT,
      }),
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

  it("WF-05 BO-07 (C-12): Từ chối công nợ chỉ dẫn tới Cancelled (BE CreditHoldService#refuse luôn huỷ)", () => {
    const reject = ORDER_ACTIONS.find((action) => action.code === "credit-reject");
    expect(reject?.outcome).toEqual({ kind: "to", statuses: ["Cancelled"] });
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
      const stayIn = action.outcome.kind === "to" ? (action.outcome.stayIn ?? []) : [];
      for (const from of action.fromStatuses) {
        if (stayIn.includes(from)) continue; // giữ nguyên trạng thái — không có cạnh để kiểm
        for (const to of targets) expect(nextOrderStatuses(from)).toContain(to);
      }
    }
  });

  it("orderActionContextOf dựng ngữ cảnh từ đơn chi tiết", () => {
    expect(
      orderActionContextOf({
        holdReason: "CREDIT",
        shipments: [],
        packedAt: null,
        firstLabeledAt: "2026-11-10T02:00:00Z",
        statusBeforeHold: null,
      }),
    ).toEqual({
      holdReason: "CREDIT",
      hasShipments: false,
      packedAt: null,
      firstLabeledAt: "2026-11-10T02:00:00Z",
      statusBeforeHold: null,
    });
  });
});

describe("allowedOrderActions — huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150)", () => {
  const packedAt = "2026-10-22T01:00:00Z";

  it("IN_PRODUCTION đã đóng sẵn hàng có sẵn, chưa lô nào bàn giao → vẫn huỷ được (Order#packedOnlyAheadOfPrints)", () => {
    expect(codes("In Production", "ORDER_COORDINATOR", { packedAt })).toContain("admin-cancel");
    expect(codes("In Production", "SALES_STAFF", { packedAt })).toEqual(["admin-cancel", "hold"]);
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
