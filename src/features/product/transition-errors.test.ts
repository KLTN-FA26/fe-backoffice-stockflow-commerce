import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";

import { productTransitionErrorMessage } from "./transition-errors";

describe("product transition errors", () => {
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

  it("keeps permission failures distinct", () => {
    expect(productTransitionErrorMessage(new ApiError(403, "FORBIDDEN", "Forbidden"))).toContain(
      "không có quyền",
    );
  });
});
