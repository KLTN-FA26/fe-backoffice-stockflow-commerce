import { describe, expect, it } from "vitest";

import { TRANSFER_PACK_FIELD_MESSAGES as MSG, TRANSFER_PACK_LIMITS } from "@/constants";

import {
  cartonInputSchema,
  kitInputSchema,
  kitReasonSchema,
  transferCompleteInputSchema,
} from "./transfer-pack-input-schemas";

describe("cartonInputSchema — TransferCartonRequest.lpn @NotBlank @Size(max = 30)", () => {
  it("cắt khoảng trắng hai đầu; trống → lỗi; quá dài → lỗi", () => {
    expect(cartonInputSchema.parse({ lpn: "  LPN-0001 " }).lpn).toBe("LPN-0001");
    expect(cartonInputSchema.safeParse({ lpn: "   " }).error?.issues[0]?.message).toBe(
      MSG.lpnRequired,
    );
    expect(
      cartonInputSchema.safeParse({ lpn: "x".repeat(TRANSFER_PACK_LIMITS.lpnMax + 1) }).error
        ?.issues[0]?.message,
    ).toBe(MSG.lpnTooLong);
    expect(
      cartonInputSchema.safeParse({ lpn: "x".repeat(TRANSFER_PACK_LIMITS.lpnMax) }).success,
    ).toBe(true);
  });
});

describe("kitInputSchema — TransferKitRequest (@Min(2) @Max(99))", () => {
  it("dòng bắt buộc; số phần trống = theo danh mục (undefined)", () => {
    expect(kitInputSchema.parse({ transferLineId: "l-1", partCount: "" })).toEqual({
      transferLineId: "l-1",
      partCount: undefined,
    });
    expect(
      kitInputSchema.safeParse({ transferLineId: "", partCount: "" }).error?.issues[0]?.message,
    ).toBe(MSG.lineRequired);
  });

  it("số phần từ 2 đến 99, nguyên", () => {
    for (const ok of ["2", "99", " 7 "])
      expect(kitInputSchema.safeParse({ transferLineId: "l", partCount: ok }).success).toBe(true);
    for (const bad of ["1", "0", "100", "2.5", "abc", "-3"]) {
      expect(
        kitInputSchema.safeParse({ transferLineId: "l", partCount: bad }).error?.issues[0]?.message,
      ).toBe(MSG.partCountRange);
    }
    expect(kitInputSchema.parse({ transferLineId: "l", partCount: "3" }).partCount).toBe(3);
  });
});

describe("kitReasonSchema (KIT-FORCE) và transferCompleteInputSchema", () => {
  it("lý do đóng kiện thường tối đa 500 ký tự, có thể trống", () => {
    expect(kitReasonSchema.safeParse("").success).toBe(true);
    expect(kitReasonSchema.safeParse("x".repeat(501)).error?.issues[0]?.message).toBe(
      MSG.kitReasonTooLong,
    );
  });

  it("hoàn tất đủ: không cần ghi chú; chỉ chuyển phần đã đóng: ghi chú bắt buộc (BE 400 note)", () => {
    expect(transferCompleteInputSchema.safeParse({ mode: "full", note: "" }).success).toBe(true);
    const partial = transferCompleteInputSchema.safeParse({ mode: "partial", note: "  " });
    expect(partial.error?.issues[0]).toMatchObject({ message: MSG.noteRequired, path: ["note"] });
    expect(transferCompleteInputSchema.parse({ mode: "partial", note: " hỏng " }).note).toBe(
      "hỏng",
    );
    expect(
      transferCompleteInputSchema.safeParse({ mode: "full", note: "x".repeat(501) }).error
        ?.issues[0]?.message,
    ).toBe(MSG.noteTooLong);
  });
});
