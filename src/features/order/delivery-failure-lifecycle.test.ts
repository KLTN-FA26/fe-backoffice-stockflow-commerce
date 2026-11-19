import { describe, expect, it } from "vitest";

import { DELIVERY_FAILURE_CASE_STATUSES, ORDER_PERMISSIONS } from "@/constants";

import {
  DELIVERY_FAILURE_TRANSITIONS,
  allowedDeliveryFailureActions,
  canCancelWithoutCase,
} from "./delivery-failure-lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "./types";

const checker = (codes: readonly PermissionCode[]) => (code: PermissionCode) =>
  codes.includes(code);

/** Sale (BE seed): đọc đơn + giữ / gỡ giữ + huỷ / đóng phần còn lại. */
const SALES = checker([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.hold, ORDER_PERMISSIONS.cancel]);
/** Quản lý kho: đọc hồ sơ của kho mình, không quyết định (release là việc ở màn release). */
const WAREHOUSE_MANAGER = checker([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.release]);
/** Điều phối đơn: chỉ có quyền huỷ / đóng phần còn lại, không gỡ giữ. */
const COORDINATOR = checker([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.cancel]);

describe("DELIVERY_FAILURE_TRANSITIONS (BE DeliveryFailureCase.Status, docs 09 §4.3)", () => {
  it("phủ mọi trạng thái BE + UNKNOWN", () => {
    expect(Object.keys(DELIVERY_FAILURE_TRANSITIONS).sort()).toEqual(
      [...DELIVERY_FAILURE_CASE_STATUSES, "UNKNOWN"].sort(),
    );
  });

  it("OPEN → REDELIVERY / CANCELLED; REDELIVERY → REDELIVERED / CANCELLED", () => {
    expect(DELIVERY_FAILURE_TRANSITIONS.OPEN).toEqual(["REDELIVERY", "CANCELLED"]);
    expect(DELIVERY_FAILURE_TRANSITIONS.REDELIVERY).toEqual(["REDELIVERED", "CANCELLED"]);
  });

  it.each(["REDELIVERED", "CANCELLED", "UNKNOWN"] as const)(
    "%s là terminal — không chuyển tiếp",
    (s) => {
      expect(DELIVERY_FAILURE_TRANSITIONS[s]).toEqual([]);
    },
  );
});

describe("allowedDeliveryFailureActions — action-gating theo trạng thái + quyền", () => {
  it("OPEN + Sale → Giao lại và Huỷ phần chưa giao", () => {
    expect(allowedDeliveryFailureActions({ status: "OPEN" }, SALES)).toEqual([
      "redeliver",
      "cancel-undelivered",
    ]);
  });

  it("REDELIVERY + Sale → chỉ còn Huỷ phần chưa giao (BE requireRedeliverable chỉ từ OPEN)", () => {
    expect(allowedDeliveryFailureActions({ status: "REDELIVERY" }, SALES)).toEqual([
      "cancel-undelivered",
    ]);
  });

  it("OPEN + Quản lý kho (chỉ đọc) → không nút nào", () => {
    expect(allowedDeliveryFailureActions({ status: "OPEN" }, WAREHOUSE_MANAGER)).toEqual([]);
  });

  it("OPEN + Điều phối (không có sales-order-holds:UPDATE) → không Giao lại", () => {
    expect(allowedDeliveryFailureActions({ status: "OPEN" }, COORDINATOR)).toEqual([
      "cancel-undelivered",
    ]);
  });

  it.each(["REDELIVERED", "CANCELLED", "UNKNOWN"] as const)(
    "%s → không render nút mutating nào kể cả với Sale",
    (status) => {
      expect(allowedDeliveryFailureActions({ status }, SALES)).toEqual([]);
    },
  );
});

describe("canCancelWithoutCase — huỷ khi lô về chưa có hồ sơ (WF-05 review F6.1)", () => {
  const shipment = (shipmentId: string, status: Order["shipments"][number]["status"]) =>
    ({ shipmentId, status }) as Order["shipments"][number];
  const held: Pick<Order, "status" | "holdReason" | "shipments"> = {
    status: "On Hold",
    holdReason: "DELIVERY_FAILED",
    shipments: [shipment("s-1", "DELIVERED"), shipment("s-2", "RETURNED")],
  };

  it("đơn giữ vì giao thất bại + lô RETURNED chưa có hồ sơ + Sale → được huỷ", () => {
    expect(canCancelWithoutCase(held, [], SALES)).toBe(true);
  });

  it("mọi lô RETURNED đã có hồ sơ → quyết trên hồ sơ, không huỷ không-hồ-sơ", () => {
    expect(canCancelWithoutCase(held, [{ shipmentId: "s-2" }], SALES)).toBe(false);
  });

  it("đơn giữ vì lý do khác → không", () => {
    expect(canCancelWithoutCase({ ...held, holdReason: "ADDRESS" }, [], SALES)).toBe(false);
  });

  it("thiếu quyền huỷ → không", () => {
    expect(canCancelWithoutCase(held, [], WAREHOUSE_MANAGER)).toBe(false);
  });
});
