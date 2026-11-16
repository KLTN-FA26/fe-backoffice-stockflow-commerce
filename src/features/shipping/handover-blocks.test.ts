import { describe, expect, it } from "vitest";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { blockedOrder } from "./__fixtures__/ftl-load";
import {
  handoverBlockedOrders,
  handoverBlockReason,
  isWaybillMissingError,
} from "./handover-blocks";

const B = UI_LABELS.shipping.waybill.blocked;

const blocked = (details?: Record<string, unknown>) =>
  new ApiError(
    409,
    "LOAD_HANDOVER_BLOCKED",
    "en",
    undefined,
    undefined,
    undefined,
    undefined,
    details,
  );

describe("handoverBlockedOrders — đọc details.orders của 409 LOAD_HANDOVER_BLOCKED", () => {
  it("parse từng đơn; amountDue đến dạng chuỗi thành số", () => {
    const orders = handoverBlockedOrders(
      blocked({
        orders: [
          {
            orderId: "o1",
            orderNumber: "SO-2",
            reasonCode: "ORDER_BALANCE_NOT_PAID",
            amountDue: "15000000.00",
            currency: "VND",
            deliveryBatchSeq: 1,
          },
          {
            orderId: "o2",
            orderNumber: "SO-3",
            reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
            windowStart: "2026-11-20",
          },
        ],
      }),
    );
    expect(orders).toHaveLength(2);
    expect(orders?.[0]).toMatchObject({
      orderNumber: "SO-2",
      amountDue: 15_000_000,
      deliveryBatchSeq: 1,
    });
    expect(orders?.[1]).toMatchObject({
      reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      windowStart: "2026-11-20",
    });
  });

  it("danh sách rỗng vẫn là danh sách (khác undefined)", () => {
    expect(handoverBlockedOrders(blocked({ orders: [] }))).toEqual([]);
  });

  it("mã lỗi khác hoặc không phải ApiError → undefined", () => {
    const other = new ApiError(
      409,
      "OPTIMISTIC_LOCK",
      "en",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        orders: [blockedOrder()],
      },
    );
    expect(handoverBlockedOrders(other)).toBeUndefined();
    expect(handoverBlockedOrders(new Error("x"))).toBeUndefined();
    expect(handoverBlockedOrders(undefined)).toBeUndefined();
  });

  it("details thiếu hoặc sai hình → undefined, không ném lỗi", () => {
    expect(handoverBlockedOrders(blocked())).toBeUndefined();
    expect(handoverBlockedOrders(blocked({}))).toBeUndefined();
    expect(handoverBlockedOrders(blocked({ orders: "none" }))).toBeUndefined();
    expect(handoverBlockedOrders(blocked({ orders: [{ orderId: "o1" }] }))).toBeUndefined();
    expect(
      handoverBlockedOrders(
        blocked({
          orders: [{ orderId: "o1", orderNumber: "SO", reasonCode: "X", amountDue: "-5" }],
        }),
      ),
    ).toBeUndefined();
  });
});

describe("isWaybillMissingError", () => {
  it("chỉ đúng với 409 LOAD_WAYBILL_MISSING", () => {
    expect(isWaybillMissingError(new ApiError(409, "LOAD_WAYBILL_MISSING", "en"))).toBe(true);
    expect(isWaybillMissingError(new ApiError(409, "LOAD_EMPTY", "en"))).toBe(false);
    expect(isWaybillMissingError(blocked({ orders: [] }))).toBe(false);
    expect(isWaybillMissingError(new Error("LOAD_WAYBILL_MISSING"))).toBe(false);
  });
});

describe("handoverBlockReason — câu tiếng Việt theo reasonCode", () => {
  it("chưa thu tiền: nêu số tiền theo tiền tệ, kèm đợt giao nếu có", () => {
    const money = formatMoney(15_000_000, "VND");
    expect(handoverBlockReason(blockedOrder({ deliveryBatchSeq: undefined }))).toBe(
      B.unpaid(money),
    );
    expect(handoverBlockReason(blockedOrder({ deliveryBatchSeq: 2 }))).toBe(
      B.unpaidBatch(money, 2),
    );
  });

  it("chưa thu tiền nhưng thiếu số tiền hoặc số tiền 0 → câu chung của mã", () => {
    expect(handoverBlockReason(blockedOrder({ amountDue: undefined }))).toBe(
      SHIPPING_ERROR_MESSAGES.ORDER_BALANCE_NOT_PAID,
    );
    expect(handoverBlockReason(blockedOrder({ amountDue: 0 }))).toBe(
      SHIPPING_ERROR_MESSAGES.ORDER_BALANCE_NOT_PAID,
    );
  });

  it("chưa thu tiền, BE không gửi tiền tệ: vẫn hiện số tiền thô", () => {
    expect(
      handoverBlockReason(blockedOrder({ currency: undefined, deliveryBatchSeq: undefined })),
    ).toBe(B.unpaid("15000000"));
  });

  it("cửa sổ giao chưa mở: nêu ngày bắt đầu, kèm đợt giao nếu có", () => {
    const base = blockedOrder({
      reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      amountDue: undefined,
      windowStart: "2026-11-20",
      deliveryBatchSeq: undefined,
    });
    const date = formatDate("2026-11-20");
    expect(handoverBlockReason(base)).toBe(B.windowNotOpen(date));
    expect(handoverBlockReason({ ...base, deliveryBatchSeq: 3 })).toBe(
      B.windowNotOpenBatch(date, 3),
    );
    expect(handoverBlockReason({ ...base, windowStart: undefined })).toBe(
      SHIPPING_ERROR_MESSAGES.DELIVERY_BATCH_WINDOW_NOT_OPEN,
    );
  });

  it("đơn tạm giữ, đơn huỷ, mã khác", () => {
    expect(handoverBlockReason(blockedOrder({ reasonCode: "ORDER_INVALID_TRANSITION" }))).toBe(
      B.onHold,
    );
    expect(handoverBlockReason(blockedOrder({ reasonCode: "ORDER_CANCELLED" }))).toBe(B.cancelled);
    expect(handoverBlockReason(blockedOrder({ reasonCode: "SOMETHING_NEW" }))).toBe(B.other);
  });
});
