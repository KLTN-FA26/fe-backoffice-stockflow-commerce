import { describe, expect, it } from "vitest";

import { apiOrder } from "./__fixtures__/order";
import { orderHistoryDtoSchema } from "./history-schemas";
import { orderDtoSchema } from "./schemas";

describe("orderDtoSchema — field của BE PR #150", () => {
  it("allowPartialShipment / printLinesReady / balancePolicy / creditTermDays được nhận", () => {
    const parsed = orderDtoSchema.parse({
      ...apiOrder,
      allowPartialShipment: true,
      printLinesReady: false,
      paymentTerm: "DEPOSIT",
      balancePolicy: "ON_CREDIT",
      creditTermDays: 30,
    });
    expect(parsed).toMatchObject({
      allowPartialShipment: true,
      printLinesReady: false,
      balancePolicy: "ON_CREDIT",
      creditTermDays: 30,
    });
  });

  it.each(["BEFORE_DELIVERY", "ON_DELIVERY", "ON_CREDIT"])("balancePolicy %s hợp lệ", (policy) => {
    expect(orderDtoSchema.parse({ ...apiOrder, balancePolicy: policy }).balancePolicy).toBe(policy);
  });

  it("balancePolicy lạ → UNKNOWN thay vì làm hỏng cả đơn", () => {
    expect(orderDtoSchema.parse({ ...apiOrder, balancePolicy: "ON_BARTER" }).balancePolicy).toBe(
      "UNKNOWN",
    );
  });

  it("BE bỏ key null (dòng danh sách không mang field) → vẫn parse được", () => {
    const parsed = orderDtoSchema.parse(apiOrder);
    expect(parsed.allowPartialShipment).toBeUndefined();
    expect(parsed.printLinesReady).toBeUndefined();
    expect(parsed.balancePolicy).toBeUndefined();
  });
});

describe("orderHistoryDtoSchema — GET /orders/{id}/history (BE PR #150)", () => {
  it("nhận cả hai loại mục: STATUS_CHANGE và PARTIAL_SHIPMENT_DECISION", () => {
    const entries = orderHistoryDtoSchema.parse([
      {
        type: "STATUS_CHANGE",
        from: "PICKING",
        to: "PACKED",
        occurredAt: "2026-10-22T01:00:00Z",
        actorName: "Kho",
      },
      {
        type: "PARTIAL_SHIPMENT_DECISION",
        reason: "Khách đồng ý",
        occurredAt: "2026-10-22T02:00:00Z",
        actorId: "u1",
        actorName: "Sale A",
        partialShipmentAllowed: true,
      },
    ]);
    expect(entries.map((entry) => entry.type)).toEqual([
      "STATUS_CHANGE",
      "PARTIAL_SHIPMENT_DECISION",
    ]);
    expect(entries[1]).toMatchObject({ partialShipmentAllowed: true, reason: "Khách đồng ý" });
  });

  it("type vắng (BE cũ) = STATUS_CHANGE; type lạ → UNKNOWN", () => {
    const [legacy, odd] = orderHistoryDtoSchema.parse([
      { from: null, to: "PENDING_PAYMENT", occurredAt: "2026-10-01T00:00:00Z" },
      { type: "SOMETHING_NEW", occurredAt: "2026-10-02T00:00:00Z" },
    ]);
    expect(legacy?.type).toBe("STATUS_CHANGE");
    expect(odd?.type).toBe("UNKNOWN");
  });
});
