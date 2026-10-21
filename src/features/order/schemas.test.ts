import { describe, expect, it } from "vitest";

import { ORDER_DELIVERY_FAILURE_REASONS, ORDER_LIMITS } from "@/constants";

import {
  adminCancelOrderSchema,
  deliveryFailureSchema,
  holdOrderSchema,
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
