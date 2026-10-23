import { describe, expect, it } from "vitest";

import { ORDER_DELIVERY_FAILURE_REASONS, ORDER_LIMITS } from "@/constants";

import {
  adminCancelOrderSchema,
  creditApprovalSchema,
  creditRejectionSchema,
  deliveryFailureSchema,
  holdOrderSchema,
  releaseOrderSchema,
  remainderClosureSchema,
  resolveOrderHoldSchema,
} from "./action-schemas";

describe("adminCancelOrderSchema — BE AdminCancelOrderRequest", () => {
  it("mã lý do + ghi chú trim", () => {
    expect(
      adminCancelOrderSchema.parse({ reasonCode: "CUSTOMER_REQUEST", note: "  Khách đổi ý  " }),
    ).toEqual({ reasonCode: "CUSTOMER_REQUEST", note: "Khách đổi ý" });
  });

  it("thiếu mã lý do → lỗi", () => {
    expect(adminCancelOrderSchema.safeParse({ note: "x" }).success).toBe(false);
  });

  it("BE Order#cancelByAdmin: OTHER không có ghi chú → lỗi ở note", () => {
    const result = adminCancelOrderSchema.safeParse({ reasonCode: "OTHER", note: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["note"]);
  });

  it("retainedPercent ngoài 0..100 → lỗi; biên 0 và 100 hợp lệ", () => {
    const base = { reasonCode: "CUSTOMER_REQUEST" as const };
    expect(adminCancelOrderSchema.safeParse({ ...base, retainedPercent: 0 }).success).toBe(true);
    expect(adminCancelOrderSchema.safeParse({ ...base, retainedPercent: 100 }).success).toBe(true);
    expect(adminCancelOrderSchema.safeParse({ ...base, retainedPercent: 101 }).success).toBe(false);
    expect(adminCancelOrderSchema.safeParse({ ...base, retainedPercent: -1 }).success).toBe(false);
  });

  it(`ghi chú tối đa ${ORDER_LIMITS.cancelNoteMax} ký tự`, () => {
    const max = ORDER_LIMITS.cancelNoteMax;
    const base = { reasonCode: "OTHER" as const };
    expect(adminCancelOrderSchema.safeParse({ ...base, note: "a".repeat(max) }).success).toBe(true);
    expect(adminCancelOrderSchema.safeParse({ ...base, note: "a".repeat(max + 1) }).success).toBe(
      false,
    );
  });
});

describe("releaseOrderSchema — BE ReleaseOrderRequest", () => {
  it("docs 17 §4.2 bước 4: bắt buộc chọn kho xuất", () => {
    expect(releaseOrderSchema.safeParse({ warehouseId: "" }).success).toBe(false);
    expect(releaseOrderSchema.parse({ warehouseId: "WH-HN-01" })).toEqual({
      warehouseId: "WH-HN-01",
    });
  });
});

describe("credit hold — BE CreditDecisionRequest / CreditRefusalRequest", () => {
  it("duyệt bắt buộc ghi chú (BE @NotBlank)", () => {
    expect(creditApprovalSchema.safeParse({ note: "  " }).success).toBe(false);
    expect(creditApprovalSchema.parse({ note: " Đã gọi xác nhận " })).toEqual({
      note: "Đã gọi xác nhận",
    });
  });

  it("từ chối CANCEL → bỏ depositPercent khỏi body", () => {
    expect(
      creditRejectionSchema.parse({ action: "CANCEL", depositPercent: 30, note: "Quá hạn" }),
    ).toEqual({ action: "CANCEL", note: "Quá hạn" });
  });

  it("SWITCH_TO_DEPOSIT: depositPercent phải trong (0, 100) — biên mở", () => {
    const base = { action: "SWITCH_TO_DEPOSIT" as const, note: "Chuyển cọc" };
    expect(creditRejectionSchema.safeParse({ ...base, depositPercent: 30 }).success).toBe(true);
    expect(creditRejectionSchema.safeParse({ ...base }).success).toBe(true);
    expect(creditRejectionSchema.safeParse({ ...base, depositPercent: 0 }).success).toBe(false);
    expect(creditRejectionSchema.safeParse({ ...base, depositPercent: 100 }).success).toBe(false);
  });
});

describe("adminCancelOrderSchema.agreedFee — BE CancellationFeeRequest (decision Q2)", () => {
  const agreedFee = { amount: 50000, reason: " Đã in ", detail: " Giữ tiền in " };

  it("khoản thoả thuận hợp lệ → trim reason / detail, không kèm retainedPercent", () => {
    expect(adminCancelOrderSchema.parse({ reasonCode: "CUSTOMER_REQUEST", agreedFee })).toEqual({
      reasonCode: "CUSTOMER_REQUEST",
      agreedFee: { amount: 50000, reason: "Đã in", detail: "Giữ tiền in" },
    });
  });

  it("BE Order#requireAgreedFee: không giữ cả phần trăm lẫn khoản thoả thuận", () => {
    const result = adminCancelOrderSchema.safeParse({
      reasonCode: "CUSTOMER_REQUEST",
      retainedPercent: 0,
      agreedFee,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["agreedFee"]);
  });

  it("amount > 0, reason / detail bắt buộc và trong giới hạn BE @Size", () => {
    const parse = (fee: Record<string, unknown>) =>
      adminCancelOrderSchema.safeParse({ reasonCode: "OTHER", note: "x", agreedFee: fee }).success;
    expect(parse({ ...agreedFee, amount: 0 })).toBe(false);
    expect(parse({ ...agreedFee, reason: "  " })).toBe(false);
    expect(parse({ ...agreedFee, detail: "" })).toBe(false);
    expect(parse({ ...agreedFee, reason: "a".repeat(ORDER_LIMITS.cancelFeeReasonMax + 1) })).toBe(
      false,
    );
    expect(parse({ ...agreedFee, detail: "a".repeat(ORDER_LIMITS.cancelFeeDetailMax + 1) })).toBe(
      false,
    );
  });
});

/* Chuyển từ schemas.test.ts của develop (BE PR #133) — input giữ / gỡ giữ / giao thất bại / đóng phần
   còn lại nay ở action-schemas.ts cùng các input thao tác khác. */

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
