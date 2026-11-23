import { describe, expect, it } from "vitest";

import { DELIVERY_FAILURE_CASE_STATUSES, ORDER_PERMISSIONS } from "@/constants";

import {
  DELIVERY_FAILURE_TRANSITIONS,
  allowedDeliveryFailureActions,
  canCancelWithoutCase,
  canCloseLostShipment,
  deliveryFailureCaseDisplay,
  newestFirst,
  showsDecisionNote,
} from "./delivery-failure-lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "./types";

const checker = (codes: readonly PermissionCode[]) => (code: PermissionCode) =>
  codes.includes(code);

/** Sale (BE seed): đọc đơn + giữ / gỡ giữ + huỷ / đóng phần còn lại + đóng phần thất lạc (PR-0 V20261216000050). */
const SALES = checker([
  ORDER_PERMISSIONS.read,
  ORDER_PERMISSIONS.hold,
  ORDER_PERMISSIONS.cancel,
  ORDER_PERMISSIONS.lostShipmentClosure,
]);
/** Quản lý kho: đọc hồ sơ của kho mình, không quyết định (release là việc ở màn release). */
const WAREHOUSE_MANAGER = checker([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.release]);
/** Điều phối đơn: huỷ / đóng phần còn lại, KHÔNG có APPROVE đóng phần thất lạc. */
const COORDINATOR = checker([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.cancel]);

const LEGACY_HOLD = { status: "On Hold", holdReason: "DELIVERY_FAILED" } as const;
const NOT_HELD = { status: "Partially Fulfilled", holdReason: null } as const;

describe("DELIVERY_FAILURE_TRANSITIONS (BE DeliveryFailureCase sau #377, WF-05 BO-01)", () => {
  it("phủ mọi trạng thái BE + UNKNOWN", () => {
    expect(Object.keys(DELIVERY_FAILURE_TRANSITIONS).sort()).toEqual(
      [...DELIVERY_FAILURE_CASE_STATUSES, "UNKNOWN"].sort(),
    );
  });

  it("không còn cạnh giao lại: OPEN / REDELIVERY (đơn cũ) chỉ → CANCELLED", () => {
    expect(DELIVERY_FAILURE_TRANSITIONS.OPEN).toEqual(["CANCELLED"]);
    expect(DELIVERY_FAILURE_TRANSITIONS.REDELIVERY).toEqual(["CANCELLED"]);
    for (const next of Object.values(DELIVERY_FAILURE_TRANSITIONS)) {
      expect(next).not.toContain("REDELIVERY");
      expect(next).not.toContain("REDELIVERED");
    }
  });

  it.each(["REDELIVERED", "CANCELLED", "UNKNOWN"] as const)(
    "%s là terminal — không chuyển tiếp",
    (s) => {
      expect(DELIVERY_FAILURE_TRANSITIONS[s]).toEqual([]);
    },
  );
});

describe("allowedDeliveryFailureActions — chỉ Huỷ phần chưa giao, chỉ đơn cũ (Q-13)", () => {
  it("đơn cũ giữ DELIVERY_FAILED + hồ sơ OPEN + Sale → chỉ Huỷ phần chưa giao (BO-01: không còn Giao lại)", () => {
    expect(allowedDeliveryFailureActions({ status: "OPEN" }, LEGACY_HOLD, SALES)).toEqual([
      "cancel-undelivered",
    ]);
    expect(allowedDeliveryFailureActions({ status: "REDELIVERY" }, LEGACY_HOLD, SALES)).toEqual([
      "cancel-undelivered",
    ]);
  });

  it("đơn KHÔNG giữ vì giao thất bại (luồng mới) → không nút nào dù hồ sơ OPEN", () => {
    expect(allowedDeliveryFailureActions({ status: "OPEN" }, NOT_HELD, SALES)).toEqual([]);
    expect(
      allowedDeliveryFailureActions(
        { status: "OPEN" },
        { status: "On Hold", holdReason: "ADDRESS" },
        SALES,
      ),
    ).toEqual([]);
  });

  it("thiếu quyền huỷ → không nút", () => {
    expect(
      allowedDeliveryFailureActions({ status: "OPEN" }, LEGACY_HOLD, WAREHOUSE_MANAGER),
    ).toEqual([]);
  });

  it.each(["REDELIVERED", "CANCELLED", "UNKNOWN"] as const)(
    "%s → không render nút mutating nào kể cả với Sale",
    (status) => {
      expect(allowedDeliveryFailureActions({ status }, LEGACY_HOLD, SALES)).toEqual([]);
    },
  );
});

describe("deliveryFailureCaseDisplay — nhãn CANCELLED theo closure (F-4)", () => {
  it("kho ghi nhận khi nhận hàng hoàn về → không nói 'Đã huỷ phần chưa giao' (BO-01)", () => {
    expect(
      deliveryFailureCaseDisplay({ status: "CANCELLED", closure: "RECORDED_ON_RETURN" }).label,
    ).toBe("Đã ghi nhận hàng hoàn về");
  });

  it("Sale huỷ → 'Đã huỷ phần chưa giao'", () => {
    expect(
      deliveryFailureCaseDisplay({ status: "CANCELLED", closure: "CANCELLED_BY_SALES" }).label,
    ).toBe("Đã huỷ phần chưa giao");
  });

  it("BE cũ (chưa có closure) → nhãn trung tính, không đoán", () => {
    expect(deliveryFailureCaseDisplay({ status: "CANCELLED", closure: null }).label).toBe(
      "Đã đóng",
    );
  });

  it("hồ sơ OPEN / REDELIVERY → ghi rõ là đơn cũ", () => {
    expect(deliveryFailureCaseDisplay({ status: "OPEN", closure: null }).label).toMatch(/đơn cũ/);
    expect(deliveryFailureCaseDisplay({ status: "REDELIVERY", closure: null }).label).toMatch(
      /đơn cũ/,
    );
  });
});

describe("showsDecisionNote — câu hệ thống của lần đóng khi nhận hàng không hiện (C-3)", () => {
  it("RECORDED_ON_RETURN → ẩn ghi chú dù BE cũ còn ghi", () => {
    expect(
      showsDecisionNote({
        decisionNote: "Closed when the shipment came back",
        closure: "RECORDED_ON_RETURN",
      }),
    ).toBe(false);
  });

  it("quyết định của Sale → hiện; trống → không", () => {
    expect(showsDecisionNote({ decisionNote: "Khách huỷ", closure: "CANCELLED_BY_SALES" })).toBe(
      true,
    );
    expect(showsDecisionNote({ decisionNote: null, closure: null })).toBe(false);
  });
});

describe("newestFirst — lịch sử mới nhất trước (BE trả cũ nhất trước)", () => {
  it("sắp theo thời điểm, giá trị hỏng xếp cuối, không đổi mảng gốc", () => {
    const rows = [
      { id: "a", openedAt: "2026-11-01T00:00:00Z" },
      { id: "b", openedAt: "không phải ngày" },
      { id: "c", openedAt: "2026-11-02T08:00:00+07:00" },
    ];
    expect(newestFirst(rows).map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("canCancelWithoutCase — huỷ khi lô về chưa có hồ sơ (đơn cũ, WF-05 review F6.1)", () => {
  const shipment = (shipmentId: string, status: Order["shipments"][number]["status"]) =>
    ({ shipmentId, status }) as Order["shipments"][number];
  const held: Pick<Order, "status" | "holdReason" | "shipments"> = {
    ...LEGACY_HOLD,
    shipments: [shipment("s-1", "DELIVERED"), shipment("s-2", "RETURNED")],
  };

  it("đơn giữ vì giao thất bại + lô RETURNED chưa có hồ sơ + Sale → được huỷ", () => {
    expect(canCancelWithoutCase(held, [], SALES)).toBe(true);
  });

  it("mọi lô RETURNED đã có hồ sơ → quyết trên hồ sơ, không huỷ không-hồ-sơ", () => {
    expect(canCancelWithoutCase(held, [{ shipmentId: "s-2" }], SALES)).toBe(false);
  });

  it("đơn giữ vì lý do khác / không giữ (luồng mới) → không", () => {
    expect(canCancelWithoutCase({ ...held, holdReason: "ADDRESS" }, [], SALES)).toBe(false);
    expect(canCancelWithoutCase({ ...held, ...NOT_HELD }, [], SALES)).toBe(false);
  });

  it("thiếu quyền huỷ → không", () => {
    expect(canCancelWithoutCase(held, [], WAREHOUSE_MANAGER)).toBe(false);
  });
});

describe("canCloseLostShipment — đóng phần thất lạc (Q-12, F-5)", () => {
  const lost = { status: "DELIVERY_FAILED", failureReason: "LOST", lostClosable: null } as const;
  const order = { status: "Partially Fulfilled" } as const;

  it("lô giao thất bại vì thất lạc + quyền APPROVE → được", () => {
    expect(canCloseLostShipment(order, lost, SALES)).toBe(true);
  });

  it("BE nói lô đã đóng (lostClosable=false, lô vẫn DELIVERY_FAILED + LOST) → không mở lại nút", () => {
    expect(canCloseLostShipment(order, { ...lost, lostClosable: false }, SALES)).toBe(false);
    expect(canCloseLostShipment(order, { ...lost, lostClosable: true }, SALES)).toBe(true);
  });

  it("không có APPROVE (chỉ có quyền huỷ) → không (QD Q-12: cần APPROVE riêng)", () => {
    expect(canCloseLostShipment(order, lost, COORDINATOR)).toBe(false);
  });

  it("lý do khác LOST, hoặc lô không còn giao thất bại → không", () => {
    expect(
      canCloseLostShipment(
        order,
        { status: "DELIVERY_FAILED", failureReason: "REFUSED", lostClosable: null },
        SALES,
      ),
    ).toBe(false);
    expect(
      canCloseLostShipment(
        order,
        { status: "RETURNED", failureReason: "LOST", lostClosable: null },
        SALES,
      ),
    ).toBe(false);
    expect(
      canCloseLostShipment(
        order,
        { status: "DELIVERED", failureReason: null, lostClosable: null },
        SALES,
      ),
    ).toBe(false);
  });

  it.each(["Cancelled", "Completed", "Closed", "UNKNOWN"] as const)(
    "đơn %s → không (không còn nợ hàng / trạng thái lạ)",
    (status) => {
      expect(canCloseLostShipment({ status }, lost, SALES)).toBe(false);
    },
  );
});
