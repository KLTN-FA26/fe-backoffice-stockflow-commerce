import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { isStaleVariantError, variantErrorMessage } from "./variant-errors";

describe("variantErrorMessage — mã BE mới có câu tiếng Việt", () => {
  it.each([
    [409, "INVALID_PRODUCT_STATUS_TRANSITION"],
    [409, "IDEMPOTENCY_KEY_REUSED"],
  ] as const)("%s %s", (status, code) => {
    expect(variantErrorMessage(new ApiError(status, code, "English"), "save")).not.toBe(
      "Không thực hiện được thao tác. Vui lòng thử lại.",
    );
  });
});

describe("isStaleVariantError — mã có câu 'Đã tải lại' phải làm mutation biến thể / ảnh tải lại thật", () => {
  it.each([
    [409, "OPTIMISTIC_LOCK", "save"],
    [404, "VARIANT_NOT_FOUND", "save"],
    [404, "MEDIA_NOT_FOUND", "media"],
    [409, "INVALID_VARIANT_TRANSITION", "media"],
  ] as const)("%s %s → dữ liệu cũ", (status, code, context) => {
    const error = new ApiError(status, code, "x");
    expect(isStaleVariantError(error)).toBe(true);
    expect(variantErrorMessage(error, context)).toMatch(/tải lại/);
  });

  it("lỗi nghiệp vụ / lỗi không phải ApiError không tải lại", () => {
    expect(isStaleVariantError(new ApiError(409, "SELF_APPROVAL_NOT_ALLOWED", "x"))).toBe(false);
    expect(isStaleVariantError(new ApiError(409, "VARIANT_SKU_ALREADY_EXISTS", "x"))).toBe(false);
    expect(isStaleVariantError(new ApiError(409, "PRODUCT_NOT_APPROVED", "x"))).toBe(false);
    expect(isStaleVariantError(new Error("OPTIMISTIC_LOCK"))).toBe(false);
  });
});
