import { describe, expect, it } from "vitest";

import { SHIPPING_CORRECTION_LABELS as C, SHIPPING_FIELD_MESSAGES as MSG } from "@/constants";

import { correctionTarget, deliveryCorrectionInputSchema } from "./correction-schemas";

const parse = (input: unknown) => deliveryCorrectionInputSchema.safeParse(input);
const messages = (input: unknown) => {
  const result = parse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("correctionTarget — sửa sang kết quả đối nghịch", () => {
  it("đã giao ↔ giao thất bại; trạng thái khác không sửa được", () => {
    expect(correctionTarget("DELIVERED")).toBe("DELIVERY_FAILED");
    expect(correctionTarget("DELIVERY_FAILED")).toBe("DELIVERED");
    expect(correctionTarget("HANDED_OVER")).toBeNull();
    expect(correctionTarget("RETURNED")).toBeNull();
  });
});

describe("deliveryCorrectionInputSchema — lý do sửa bắt buộc (docs 09 §4.3 bước 5)", () => {
  it("thiếu lý do sửa → lỗi; chỉ khoảng trắng cũng không được", () => {
    expect(messages({ outcome: "DELIVERED", reason: "" })).toEqual([C.reasonRequired]);
    expect(messages({ outcome: "DELIVERED", reason: "   " })).toEqual([C.reasonRequired]);
  });

  it("lý do quá 500 ký tự → lỗi", () => {
    expect(messages({ outcome: "DELIVERED", reason: "a".repeat(501) })).toEqual([MSG.tooLong]);
  });

  it("sửa thành đã giao: lý do + thời điểm giao, bỏ lý do / ghi chú thất bại", () => {
    const result = parse({
      outcome: "DELIVERED",
      reason: " khách xác nhận ",
      failureReason: "LOST",
      note: "x",
      deliveredAt: "2026-11-17T07:30:00.000Z",
    });
    expect(result.data).toEqual({
      outcome: "DELIVERED",
      reason: "khách xác nhận",
      failureReason: undefined,
      note: undefined,
      deliveredAt: "2026-11-17T07:30:00.000Z",
    });
  });

  it("sửa thành giao thất bại: bắt buộc lý do thất bại; OTHER bắt buộc ghi chú; bỏ thời điểm giao", () => {
    expect(messages({ outcome: "DELIVERY_FAILED", reason: "r" })).toEqual([MSG.reasonRequired]);
    expect(messages({ outcome: "DELIVERY_FAILED", reason: "r", failureReason: "OTHER" })).toEqual([
      MSG.noteRequiredForOther,
    ]);
    expect(
      parse({
        outcome: "DELIVERY_FAILED",
        reason: "r",
        failureReason: "OTHER",
        note: "đổi địa chỉ",
        deliveredAt: "2026-11-17T07:30:00.000Z",
      }).data,
    ).toEqual({
      outcome: "DELIVERY_FAILED",
      reason: "r",
      failureReason: "OTHER",
      note: "đổi địa chỉ",
      deliveredAt: undefined,
    });
  });

  it("kết quả ngoài hai kết quả được sửa bị từ chối", () => {
    expect(parse({ outcome: "RETURNED", reason: "r" }).success).toBe(false);
  });
});
