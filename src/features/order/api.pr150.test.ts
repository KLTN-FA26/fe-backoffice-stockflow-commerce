import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { closeOrderRemainder, toOrder } from "./api";
import { getOrderHistory, toOrderHistoryEntry } from "./history-api";
import { decidePartialShipment } from "./partial-shipment-api";
import { orderDtoSchema } from "./schemas";

import { apiOrder } from "./__fixtures__/order";

afterEach(() => vi.restoreAllMocks());

const beOrder = apiOrder;

describe("order API — BE PR #150 (giao một phần, công nợ phần còn lại, lịch sử)", () => {
  const ID = beOrder.orderId;

  it("toOrder: allowPartialShipment / printLinesReady / balancePolicy / creditTermDays", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        paymentTerm: "DEPOSIT",
        balancePolicy: "ON_CREDIT",
        creditTermDays: 30,
        allowPartialShipment: true,
        printLinesReady: false,
      }),
    );
    expect(order).toMatchObject({
      balancePolicy: "ON_CREDIT",
      creditTermDays: 30,
      allowPartialShipment: true,
      printLinesReady: false,
    });
  });

  it("toOrder: BE không trả các field → null (không đoán là false)", () => {
    const order = toOrder(orderDtoSchema.parse(beOrder));
    expect(order).toMatchObject({
      balancePolicy: null,
      creditTermDays: null,
      allowPartialShipment: null,
      printLinesReady: null,
    });
  });

  it("decidePartialShipment: PUT /orders/{id}/partial-shipment {allowed, note?}", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: beOrder });
    await decidePartialShipment({ id: ID, allowed: true, note: "Khách đồng ý" });
    await decidePartialShipment({ id: ID, allowed: false, note: "" });
    expect(put).toHaveBeenNthCalledWith(1, `/orders/${ID}/partial-shipment`, {
      allowed: true,
      note: "Khách đồng ý",
    });
    // note rỗng bị bỏ khỏi body (BE @Size, null hợp lệ)
    expect(put).toHaveBeenNthCalledWith(2, `/orders/${ID}/partial-shipment`, { allowed: false });
  });

  it("closeOrderRemainder: agreedFee chỉ gửi khi có", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const agreedFee = { amount: 4_000_000, reason: "Đã in", detail: "Khách đồng ý" };
    await closeOrderRemainder({ id: ID, reasonCode: "CUSTOMER_REQUEST", note: "", agreedFee });
    await closeOrderRemainder({ id: ID, reasonCode: "CUSTOMER_REQUEST", note: "" });
    expect(post).toHaveBeenNthCalledWith(1, `/orders/${ID}/remainder-closure`, {
      reasonCode: "CUSTOMER_REQUEST",
      agreedFee,
    });
    expect(post).toHaveBeenNthCalledWith(2, `/orders/${ID}/remainder-closure`, {
      reasonCode: "CUSTOMER_REQUEST",
    });
  });

  it("getOrderHistory: GET /orders/{id}/history, phân loại mục theo type", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: [
        {
          type: "STATUS_CHANGE",
          from: null,
          to: "PENDING_PAYMENT",
          occurredAt: "2026-10-01T00:00:00Z",
        },
        {
          type: "STATUS_CHANGE",
          from: "PICKING",
          to: "PACKED",
          reason: "ok",
          occurredAt: "2026-10-02T00:00:00Z",
          actorName: "Kho A",
        },
        {
          type: "PARTIAL_SHIPMENT_DECISION",
          from: null,
          to: null,
          reason: "Khách đồng ý",
          occurredAt: "2026-10-03T00:00:00Z",
          actorName: "Sale A",
          partialShipmentAllowed: false,
        },
      ],
    });

    const entries = await getOrderHistory(ID);

    expect(get).toHaveBeenCalledWith(`/orders/${ID}/history`, { signal: undefined });
    expect(entries).toEqual([
      {
        kind: "status-change",
        from: null,
        to: "Pending Payment",
        reason: null,
        actorName: null,
        occurredAt: "2026-10-01T00:00:00Z",
      },
      {
        kind: "status-change",
        from: "Picking",
        to: "Packed",
        reason: "ok",
        actorName: "Kho A",
        occurredAt: "2026-10-02T00:00:00Z",
      },
      {
        kind: "partial-shipment",
        allowed: false,
        reason: "Khách đồng ý",
        actorName: "Sale A",
        occurredAt: "2026-10-03T00:00:00Z",
      },
    ]);
  });

  it("toOrderHistoryEntry: type lạ, hoặc thiếu dữ liệu cần → 'unknown', không hỏng lịch sử", () => {
    const base = { occurredAt: "2026-10-01T00:00:00Z" };
    expect(toOrderHistoryEntry({ ...base, type: "UNKNOWN" }).kind).toBe("unknown");
    // quyết định mà thiếu cờ allowed → không đoán
    expect(toOrderHistoryEntry({ ...base, type: "PARTIAL_SHIPMENT_DECISION" }).kind).toBe(
      "unknown",
    );
    // đổi trạng thái mà thiếu `to`
    expect(toOrderHistoryEntry({ ...base, type: "STATUS_CHANGE" }).kind).toBe("unknown");
  });
});
