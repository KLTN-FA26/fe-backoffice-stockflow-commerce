import { describe, expect, it } from "vitest";

import { PRODUCTION_ORDER_STATUSES } from "@/constants";

import { isReceivableProductionOrder, openCartonsOf, orderedCartonsOf } from "./production-orders";

describe("isReceivableProductionOrder — BR-01 / BR-15 (docs 03 §6)", () => {
  it.each(["IN_PRODUCTION", "PARTIALLY_RECEIVED"] as const)(
    "%s → nhận được, kể cả bật cờ duyệt mẫu",
    (status) => {
      expect(isReceivableProductionOrder({ status, sampleApprovalRequired: true })).toBe(true);
    },
  );

  it.each(["SENT", "ACCEPTED"] as const)(
    "%s: không bật cờ duyệt mẫu → nhận được; bật → chặn",
    (status) => {
      expect(isReceivableProductionOrder({ status, sampleApprovalRequired: false })).toBe(true);
      expect(isReceivableProductionOrder({ status, sampleApprovalRequired: true })).toBe(false);
    },
  );

  it.each(
    PRODUCTION_ORDER_STATUSES.filter(
      (s) => !["IN_PRODUCTION", "PARTIALLY_RECEIVED", "SENT", "ACCEPTED"].includes(s),
    ),
  )("%s → không nhận được", (status) => {
    expect(isReceivableProductionOrder({ status, sampleApprovalRequired: false })).toBe(false);
  });
});

describe("openCartonsOf / orderedCartonsOf", () => {
  it("cộng thùng còn mở của mọi dòng, không âm khi dòng đã nhận đủ", () => {
    const order = {
      lines: [
        { id: "a", sku: "A", cartons: 10, unitsPerCarton: 50, receivedCartons: 4 },
        { id: "b", sku: "B", cartons: 2, unitsPerCarton: 24, receivedCartons: 2 },
      ],
    };
    expect(openCartonsOf(order)).toBe(6);
    expect(orderedCartonsOf(order)).toBe(12);
  });
});
