import { describe, expect, it } from "vitest";

import { CARTON_CHECK_FIELD_MESSAGES as MSG, CARTON_CHECK_LIMITS } from "@/constants";

import {
  completeInputSchema,
  lpnInputSchema,
  removalInputSchema,
} from "./carton-check-input-schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("lpnInputSchema — BE CartonScanRequest.lpn @NotBlank @Size(max = 30)", () => {
  it("cắt khoảng trắng hai đầu; giữ nguyên chữ hoa / thường (BE nhận mọi kiểu)", () => {
    expect(lpnInputSchema.parse("  lpn000001 ")).toBe("lpn000001");
  });

  it("rỗng → nhắc nhập / quét LPN", () => {
    expect(firstMessage(lpnInputSchema.safeParse("   "))).toBe(MSG.lpnRequired);
  });

  it("quá 30 ký tự → từ chối", () => {
    expect(lpnInputSchema.safeParse("L".repeat(CARTON_CHECK_LIMITS.lpnMax)).success).toBe(true);
    expect(firstMessage(lpnInputSchema.safeParse("L".repeat(CARTON_CHECK_LIMITS.lpnMax + 1)))).toBe(
      MSG.lpnTooLong,
    );
  });
});

describe("removalInputSchema — BE CartonRemovalRequest.note @Size(max = 500), không bắt buộc", () => {
  it("ghi chú rỗng hợp lệ", () => {
    expect(removalInputSchema.parse({ note: "  " }).note).toBe("");
  });

  it("quá 500 ký tự → từ chối", () => {
    expect(removalInputSchema.safeParse({ note: "a".repeat(500) }).success).toBe(true);
    expect(firstMessage(removalInputSchema.safeParse({ note: "a".repeat(501) }))).toBe(
      MSG.noteTooLong,
    );
  });
});

describe("completeInputSchema — docs 08 §4.4 bước 8.3: giao một phần phải ghi chú", () => {
  it("đủ thùng không cần ghi chú", () => {
    expect(completeInputSchema.safeParse({ mode: "full", note: "" }).success).toBe(true);
  });

  it("giao một phần mà thiếu ghi chú → báo lỗi ở field note", () => {
    const result = completeInputSchema.safeParse({ mode: "partial", note: "   " });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(MSG.noteRequired);
    expect(result.error?.issues[0]?.path).toEqual(["note"]);
  });

  it("giao một phần có ghi chú hợp lệ; ghi chú quá 500 ký tự bị từ chối", () => {
    expect(
      completeInputSchema.safeParse({ mode: "partial", note: "Thùng hỏng đã loại" }).success,
    ).toBe(true);
    expect(completeInputSchema.safeParse({ mode: "partial", note: "a".repeat(501) }).success).toBe(
      false,
    );
  });
});
