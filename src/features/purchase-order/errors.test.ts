import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { PO_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStalePoError, poErrorMessage } from "./errors";

describe("poErrorMessage — lỗi BE → câu tiếng Việt", () => {
  it("response sai hợp đồng (ZodError) / lỗi lạ → câu chung, không lộ message thô", () => {
    expect(poErrorMessage(new ZodError([]))).toBe(PO_ERROR_MESSAGES.CONTRACT_MISMATCH);
    expect(poErrorMessage(new Error("boom"))).toBe(PO_ERROR_MESSAGES.generic);
  });

  it("fieldErrors của dòng → 'Dòng n — <nhãn field>'", () => {
    const err = new ApiError(400, "VALIDATION_FAILED", "x", {
      "lines[1].quantityOrdered": "must be positive",
    });
    expect(poErrorMessage(err)).toBe(`${PO_ERROR_MESSAGES.VALIDATION_FAILED}: Dòng 2 — SL đặt`);
  });

  it("nhận hàng bị 400 không field → câu riêng của nhận hàng", () => {
    const err = new ApiError(400, "VALIDATION_FAILED", "Cannot receive 5");
    expect(poErrorMessage(err, "receive")).toBe(PO_ERROR_MESSAGES.receiveRejected);
    expect(poErrorMessage(err)).toBe(PO_ERROR_MESSAGES.VALIDATION_FAILED);
  });

  it("gửi NCC bị 409 CONFLICT → giải thích ngày giao / NCC", () => {
    const err = new ApiError(409, "CONFLICT", "Confirm a delivery date…");
    expect(poErrorMessage(err, "send")).toBe(PO_ERROR_MESSAGES.sendDateInvalid);
    expect(poErrorMessage(err)).toBe(PO_ERROR_MESSAGES.CONFLICT);
  });

  it("mã lạ: 403 → không có quyền, 404 → không tìm thấy PO, còn lại → câu chung", () => {
    expect(poErrorMessage(new ApiError(403, "SOMETHING_NEW", "x"))).toBe(
      PO_ERROR_MESSAGES.FORBIDDEN,
    );
    expect(poErrorMessage(new ApiError(404, "SOMETHING_NEW", "x"))).toBe(
      PO_ERROR_MESSAGES.PURCHASE_ORDER_NOT_FOUND,
    );
    expect(poErrorMessage(new ApiError(500, "SOMETHING_NEW", "x"))).toBe(PO_ERROR_MESSAGES.generic);
  });
});

describe("isStalePoError — dữ liệu trên màn đã cũ, cần tải lại PO", () => {
  it("409 và 400 không field → cũ; 400 có field / lỗi khác → không", () => {
    expect(isStalePoError(new ApiError(409, "INVALID_PURCHASE_ORDER_TRANSITION", "x"))).toBe(true);
    expect(isStalePoError(new ApiError(400, "VALIDATION_FAILED", "x"))).toBe(true);
    expect(isStalePoError(new ApiError(400, "VALIDATION_FAILED", "x", { reason: "blank" }))).toBe(
      false,
    );
    expect(isStalePoError(new Error("x"))).toBe(false);
  });
});
