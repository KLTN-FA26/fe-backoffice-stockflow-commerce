import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { attributeErrorMessage, isStaleAttributeError } from "./attribute-errors";

describe("isStaleAttributeError — các mã có câu 'Đã tải lại' phải làm mutation tải lại thật", () => {
  it.each([
    [409, "OPTIMISTIC_LOCK"],
    [404, "ATTRIBUTE_NOT_FOUND"],
    [404, "ATTRIBUTE_VALUE_NOT_FOUND"],
  ])("%s %s → dữ liệu cũ", (status, code) => {
    const error = new ApiError(status, code, "x");
    expect(isStaleAttributeError(error)).toBe(true);
    expect(attributeErrorMessage(error, "axes")).toMatch(/tải lại/);
  });

  it("lỗi nghiệp vụ / lỗi không phải ApiError không tải lại", () => {
    expect(isStaleAttributeError(new ApiError(409, "ATTRIBUTE_IN_USE", "x"))).toBe(false);
    expect(isStaleAttributeError(new ApiError(409, "PRODUCT_AXES_LOCKED", "x"))).toBe(false);
    expect(isStaleAttributeError(new Error("OPTIMISTIC_LOCK"))).toBe(false);
  });
});
