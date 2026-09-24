import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError } from "./error";

describe("ApiError", () => {
  it("normalizes the backend ApiResponse error envelope", () => {
    const error = new AxiosError("Bad request", undefined, undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      data: {
        success: false,
        errorCode: "VALIDATION_FAILED",
        message: "Dữ liệu không hợp lệ",
        fieldErrors: [{ field: "name", message: "name is required", code: "NotBlank" }],
        correlationId: "corr-123",
      },
      headers: {},
      status: 400,
      statusText: "Bad Request",
    });

    expect(ApiError.from(error)).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { name: "name is required" },
      status: 400,
      traceId: "corr-123",
    });
  });
});
