import { describe, expect, it } from "vitest";

import { ORDER_DELIVERY_FAILURE_REASONS, ORDER_LIMITS } from "@/constants";

import { apiOrder } from "./__fixtures__/order";
import {
  adminCancelOrderSchema,
  agreedFeeSchema,
  deliveryFailureSchema,
  holdOrderSchema,
  orderDtoSchema,
  orderHistoryDtoSchema,
  partialShipmentSchema,
  remainderClosureSchema,
  resolveOrderHoldSchema,
} from "./schemas";

describe("adminCancelOrderSchema — body POST /orders/{id}/admin-cancellation", () => {
  it("trim lý do trước khi gửi", () => {
    expect(adminCancelOrderSchema.parse({ reason: "  Khách đổi ý  " })).toEqual({
      reason: "Khách đổi ý",
    });
  });

  it("chỉ khoảng trắng → lỗi bắt buộc (BE @NotBlank)", () => {
    const result = adminCancelOrderSchema.safeParse({ reason: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Lý do huỷ là bắt buộc");
  });

  it("đúng 500 ký tự hợp lệ; 501 ký tự bị chặn (cột VARCHAR(500))", () => {
    const max = ORDER_LIMITS.cancelReasonMax;
    expect(adminCancelOrderSchema.safeParse({ reason: "a".repeat(max) }).success).toBe(true);
    const tooLong = adminCancelOrderSchema.safeParse({ reason: "a".repeat(max + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe(`Lý do huỷ tối đa ${max} ký tự`);
  });
});

describe("holdOrderSchema — body POST /orders/{id}/hold (BE HoldOrderRequest)", () => {
  it.each(["PAYMENT", "ADDRESS", "INVENTORY", "CUSTOMER", "FRAUD"])(
    "%s không cần ghi chú; note được trim",
    (reasonCode) => {
      expect(holdOrderSchema.parse({ reasonCode, note: "  Chờ khách  " })).toEqual({
        reasonCode,
        note: "Chờ khách",
      });
      expect(holdOrderSchema.safeParse({ reasonCode, note: "" }).success).toBe(true);
    },
  );

  it("OTHER bắt buộc ghi chú (BE Order#putOnHold) — chỉ khoảng trắng cũng bị chặn", () => {
    for (const note of ["", "   "]) {
      const result = holdOrderSchema.safeParse({ reasonCode: "OTHER", note });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["note"]);
    }
    expect(holdOrderSchema.safeParse({ reasonCode: "OTHER", note: "Lý do" }).success).toBe(true);
  });

  it("CREDIT / DESIGN_MISMATCH là của hệ thống → không nhận; thiếu lý do → lỗi", () => {
    expect(holdOrderSchema.safeParse({ reasonCode: "CREDIT", note: "" }).success).toBe(false);
    expect(holdOrderSchema.safeParse({ reasonCode: "DESIGN_MISMATCH", note: "" }).success).toBe(
      false,
    );
    expect(holdOrderSchema.safeParse({ reasonCode: "", note: "" }).success).toBe(false);
  });

  it("ghi chú tối đa 1000 ký tự (BE @Size)", () => {
    const max = ORDER_LIMITS.holdNoteMax;
    expect(holdOrderSchema.safeParse({ reasonCode: "FRAUD", note: "a".repeat(max) }).success).toBe(
      true,
    );
    expect(
      holdOrderSchema.safeParse({ reasonCode: "FRAUD", note: "a".repeat(max + 1) }).success,
    ).toBe(false);
  });
});

describe("resolveOrderHoldSchema — body POST /orders/{id}/hold/resolution (BE @NotBlank)", () => {
  it("ghi chú bắt buộc, trim, tối đa 1000", () => {
    expect(resolveOrderHoldSchema.parse({ note: " ok " })).toEqual({ note: "ok" });
    expect(resolveOrderHoldSchema.safeParse({ note: "  " }).success).toBe(false);
    expect(
      resolveOrderHoldSchema.safeParse({ note: "a".repeat(ORDER_LIMITS.resolveNoteMax + 1) })
        .success,
    ).toBe(false);
  });
});

describe("deliveryFailureSchema / remainderClosureSchema", () => {
  it("giao thất bại: đủ 6 lý do BE, OTHER cần ghi chú, ghi chú ≤ 500", () => {
    for (const reasonCode of ORDER_DELIVERY_FAILURE_REASONS.filter((r) => r !== "OTHER")) {
      expect(deliveryFailureSchema.safeParse({ reasonCode, note: "" }).success).toBe(true);
    }
    expect(deliveryFailureSchema.safeParse({ reasonCode: "OTHER", note: "" }).success).toBe(false);
    expect(
      deliveryFailureSchema.safeParse({
        reasonCode: "LOST",
        note: "a".repeat(ORDER_LIMITS.deliveryFailureNoteMax + 1),
      }).success,
    ).toBe(false);
  });

  it("đóng phần còn lại: OTHER cần ghi chú; lý do ngoài danh sách chọn bị chặn", () => {
    expect(remainderClosureSchema.safeParse({ reasonCode: "OUT_OF_STOCK", note: "" }).success).toBe(
      true,
    );
    expect(remainderClosureSchema.safeParse({ reasonCode: "OTHER", note: " " }).success).toBe(
      false,
    );
    expect(
      remainderClosureSchema.safeParse({ reasonCode: "CREDIT_REJECTED", note: "" }).success,
    ).toBe(false);
  });
});

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

describe("partialShipmentSchema — body PUT /orders/{id}/partial-shipment", () => {
  it("allowed bắt buộc là boolean; note trim, không bắt buộc", () => {
    expect(partialShipmentSchema.parse({ allowed: true, note: "  Khách đồng ý  " })).toEqual({
      allowed: true,
      note: "Khách đồng ý",
    });
    expect(partialShipmentSchema.safeParse({ allowed: false, note: "" }).success).toBe(true);
    expect(partialShipmentSchema.safeParse({ note: "" }).success).toBe(false);
  });

  it("note tối đa 500 ký tự (BE @Size)", () => {
    const max = ORDER_LIMITS.partialShipmentNoteMax;
    expect(max).toBe(500);
    expect(partialShipmentSchema.safeParse({ allowed: true, note: "a".repeat(max) }).success).toBe(
      true,
    );
    expect(
      partialShipmentSchema.safeParse({ allowed: true, note: "a".repeat(max + 1) }).success,
    ).toBe(false);
  });
});

describe("agreedFeeSchema / remainderClosureSchema — phí đã thoả thuận (BE CancellationFeeRequest)", () => {
  const fee = { amount: 4_000_000, reason: "Đã in 2 lô", detail: "Khách đồng ý qua điện thoại" };

  it("số tiền nguyên > 0, lý do và chi tiết bắt buộc (được trim)", () => {
    expect(agreedFeeSchema.parse({ ...fee, reason: "  Đã in  ", detail: " ok " })).toEqual({
      amount: 4_000_000,
      reason: "Đã in",
      detail: "ok",
    });
    for (const amount of [0, -1, 1.5, Number.NaN]) {
      const result = agreedFeeSchema.safeParse({ ...fee, amount });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Nhập số tiền nguyên lớn hơn 0");
    }
    expect(agreedFeeSchema.safeParse({ ...fee, reason: "  " }).success).toBe(false);
    expect(agreedFeeSchema.safeParse({ ...fee, detail: "" }).success).toBe(false);
  });

  it("lý do ≤ 500, chi tiết ≤ 2000 ký tự", () => {
    expect(agreedFeeSchema.safeParse({ ...fee, reason: "a".repeat(501) }).success).toBe(false);
    expect(agreedFeeSchema.safeParse({ ...fee, detail: "a".repeat(2001) }).success).toBe(false);
    expect(
      agreedFeeSchema.safeParse({ ...fee, reason: "a".repeat(500), detail: "a".repeat(2000) })
        .success,
    ).toBe(true);
  });

  it("agreedFee tuỳ chọn trong remainderClosureSchema; lỗi của phí có đường dẫn agreedFee.*", () => {
    expect(remainderClosureSchema.safeParse({ reasonCode: "OUT_OF_STOCK", note: "" }).success).toBe(
      true,
    );
    const ok = remainderClosureSchema.parse({
      reasonCode: "OUT_OF_STOCK",
      note: "",
      agreedFee: fee,
    });
    expect(ok.agreedFee).toEqual(fee);
    const bad = remainderClosureSchema.safeParse({
      reasonCode: "OUT_OF_STOCK",
      note: "",
      agreedFee: { ...fee, amount: 0 },
    });
    expect(bad.error?.issues[0]?.path).toEqual(["agreedFee", "amount"]);
  });
});
