import { describe, expect, it } from "vitest";

import { RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleReceiptError, receiptErrorMessage } from "./errors";

describe("receipt errors", () => {
  it("mã lỗi nghiệp vụ BE → câu tiếng Việt, không lộ message tiếng Anh", () => {
    const message = receiptErrorMessage(
      new ApiError(409, "INVALID_RECEIPT_TRANSITION", "Receipt GR-1 is a purchase receipt"),
    );
    expect(message).toBe(RECEIPT_ERROR_MESSAGES.INVALID_RECEIPT_TRANSITION);
    expect(message).not.toContain("purchase receipt");
  });

  it("mã lạ → dùng message BE (đã dịch); lỗi không phải ApiError → câu chung", () => {
    expect(receiptErrorMessage(new ApiError(409, "SOMETHING_NEW", "Câu của BE"))).toBe(
      "Câu của BE",
    );
    expect(receiptErrorMessage(new Error("boom"))).toBe(RECEIPT_ERROR_MESSAGES.generic);
  });

  it.each([
    "INVALID_RECEIPT_TRANSITION",
    "PRODUCTION_ORDER_NOT_RECEIVABLE",
    "OPTIMISTIC_LOCK",
    "STOCK_PACKAGE_NOT_FOUND",
    "INVALID_STOCK_PACKAGE_TRANSITION",
    "STOCK_PACKAGE_WRONG_LOCATION",
  ])("%s: dữ liệu đã đổi ở nơi khác → tải lại phiếu", (code) => {
    expect(isStaleReceiptError(new ApiError(409, code, "x"))).toBe(true);
  });

  it("lỗi khác không phải dữ liệu cũ; mã PO đã gỡ không còn được coi là dữ liệu cũ", () => {
    expect(isStaleReceiptError(new ApiError(409, "LOCATION_AREA_MISMATCH", "x"))).toBe(false);
    expect(isStaleReceiptError(new ApiError(409, "PURCHASE_ORDER_NOT_RECEIVABLE", "x"))).toBe(
      false,
    );
    expect(isStaleReceiptError(new Error("boom"))).toBe(false);
  });
});
