import { describe, expect, it } from "vitest";

import { RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleReceiptError, receiptErrorMessage, receiptLineFieldErrors } from "./errors";

describe("receipt errors", () => {
  it("mã lỗi nghiệp vụ BE → câu tiếng Việt, không lộ message tiếng Anh", () => {
    const error = new ApiError(
      409,
      "OVER_RECEIPT_TOLERANCE",
      "Line 2 of PO-HCM-DEMO-0002 would be received 7 of 6",
    );
    expect(receiptErrorMessage(error)).toBe(RECEIPT_ERROR_MESSAGES.OVER_RECEIPT_TOLERANCE);
  });

  it("lỗi không phải ApiError → câu chung", () => {
    expect(receiptErrorMessage(new Error("boom"))).toBe(RECEIPT_ERROR_MESSAGES.generic);
  });

  it("lỗi trạng thái đã đổi → cần tải lại dữ liệu", () => {
    expect(isStaleReceiptError(new ApiError(409, "INVALID_RECEIPT_TRANSITION", "x"))).toBe(true);
    expect(isStaleReceiptError(new ApiError(409, "LOCATION_AREA_MISMATCH", "x"))).toBe(false);
  });

  it("fieldErrors lines[i].field của @Valid → lỗi theo dòng form", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "invalid", {
      "lines[1].locationCode": "không được để trống",
      deliveryNote: "quá dài",
    });
    expect(receiptLineFieldErrors(error)).toEqual([
      { index: 1, field: "locationCode", message: "không được để trống" },
    ]);
  });
});
