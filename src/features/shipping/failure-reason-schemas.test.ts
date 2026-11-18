import { describe, expect, it } from "vitest";

import { SHIPPING_FIELD_MESSAGES as MSG } from "@/constants";

import { failureReasonCorrectionInputSchema, hasFailureReason } from "./failure-reason-schemas";

describe("sửa lý do giao thất bại (docs 09 edge hoàn hàng khi còn Handed Over)", () => {
  it("bắt buộc lý do thất bại và lý do sửa; ghi chú trống bỏ đi", () => {
    expect(
      failureReasonCorrectionInputSchema.parse({
        failureReason: "REFUSED",
        note: " ",
        reason: " vì hãng gọi lại ",
      }),
    ).toEqual({ failureReason: "REFUSED", note: undefined, reason: "vì hãng gọi lại" });
    expect(
      failureReasonCorrectionInputSchema.safeParse({ failureReason: "REFUSED", reason: " " })
        .success,
    ).toBe(false);
    expect(failureReasonCorrectionInputSchema.safeParse({ reason: "x" }).success).toBe(false);
  });

  it("docs 09 §4.3 bước 3: lý do Khác bắt buộc ghi chú", () => {
    const parsed = failureReasonCorrectionInputSchema.safeParse({
      failureReason: "OTHER",
      reason: "x",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(MSG.noteRequiredForOther);
  });

  it("chỉ lô đã giao thất bại / đã hoàn và có lý do mới có lý do để sửa", () => {
    expect(hasFailureReason({ status: "RETURNED", failureReason: "OTHER" })).toBe(true);
    expect(hasFailureReason({ status: "DELIVERY_FAILED", failureReason: "LOST" })).toBe(true);
    expect(hasFailureReason({ status: "DELIVERED", failureReason: "LOST" })).toBe(false);
    expect(hasFailureReason({ status: "RETURNED", failureReason: null })).toBe(false);
  });
});
