import { describe, expect, it } from "vitest";

import { ORDER_LIMITS } from "@/constants";

import {
  adminCancelOrderSchema,
  creditApprovalSchema,
  creditRejectionSchema,
  releaseOrderSchema,
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
