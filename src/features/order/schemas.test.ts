import { describe, expect, it } from "vitest";

import { ORDER_LIMITS } from "@/constants";

import { adminCancelOrderSchema } from "./schemas";

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
