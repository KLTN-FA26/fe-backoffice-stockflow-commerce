import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";

import { productTransitionErrorMessage } from "./transition-errors";

const GALLERY_REQUIRED = "Cần duyệt ít nhất một ảnh trong gallery trước khi xuất bản sản phẩm.";

describe("product transition errors", () => {
  it.each([
    "An approved non-empty product gallery is required",
    "Cần bộ ảnh không rỗng đã được duyệt",
    "reworded by the backend tomorrow",
  ])("PRODUCT_GALLERY_REQUIRED maps by code whatever the server text (%s)", (message) => {
    expect(
      productTransitionErrorMessage(new ApiError(409, "PRODUCT_GALLERY_REQUIRED", message)),
    ).toBe(GALLERY_REQUIRED);
  });

  it("a generic CONFLICT with the old English sentence gets no special treatment", () => {
    const old = "Approve a non-empty product gallery before publishing the product";
    expect(productTransitionErrorMessage(new ApiError(409, "CONFLICT", old))).toBe(old);
    expect(productTransitionErrorMessage(new ApiError(409, "CONFLICT", "Another conflict"))).toBe(
      "Another conflict",
    );
  });

  it("unknown codes fall back to the server text, then to the generic sentence", () => {
    expect(productTransitionErrorMessage(new ApiError(409, "SOME_NEW_CODE", "Server detail"))).toBe(
      "Server detail",
    );
    expect(productTransitionErrorMessage(new ApiError(500, "INTERNAL_ERROR", ""))).toBe(
      "Không thể cập nhật trạng thái sản phẩm.",
    );
  });

  it("uses stable backend codes for self approval and stale status", () => {
    expect(
      productTransitionErrorMessage(
        new ApiError(409, "SELF_APPROVAL_NOT_ALLOWED", "translated server message"),
      ),
    ).toContain("chính mình");
    expect(
      productTransitionErrorMessage(
        new ApiError(409, "INVALID_PRODUCT_STATUS_TRANSITION", "translated server message"),
      ),
    ).toContain("Trạng thái sản phẩm");
  });

  it.each(["FORBIDDEN", "ACCESS_DENIED", "OUT_OF_DATA_SCOPE"])(
    "%s stays a permission message",
    (code) => {
      expect(productTransitionErrorMessage(new ApiError(403, code, "Forbidden"))).toBe(
        "Bạn không có quyền thực hiện thao tác này.",
      );
    },
  );

  it("VALIDATION_FAILED distinguishes a missing reject reason via fieldErrors", () => {
    expect(
      productTransitionErrorMessage(
        new ApiError(400, "VALIDATION_FAILED", "x", { reason: "must not be blank" }),
      ),
    ).toBe("Vui lòng nhập lý do từ chối.");
    expect(productTransitionErrorMessage(new ApiError(400, "VALIDATION_FAILED", "x"))).toBe(
      "Dữ liệu chuyển trạng thái không hợp lệ.",
    );
  });
});
