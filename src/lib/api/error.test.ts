import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError } from "./error";

import type { ApiErrorBody } from "./error";

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

  function fromBody(status: number, data: unknown): ApiError {
    return ApiError.from(
      new AxiosError("x", undefined, undefined, undefined, {
        config: { headers: new AxiosHeaders() },
        // Body lỗi đến từ mạng có thể sai hình — ép kiểu để mô phỏng đúng tình huống đó
        data: data as ApiErrorBody,
        headers: {},
        status,
        statusText: "",
      }),
    );
  }

  it("keeps every field of a multi-field validation error; first message per field wins", () => {
    const error = fromBody(400, {
      errorCode: "VALIDATION_FAILED",
      fieldErrors: [
        { field: "note", message: "note is required", code: "NotBlank" },
        { field: "depositPercent", message: "must be below 100", code: "DecimalMax" },
        { field: "note", message: "second note message" },
      ],
    });
    expect(error.fieldErrors).toEqual({
      note: "note is required",
      depositPercent: "must be below 100",
    });
  });

  it("skips malformed fieldErrors entries instead of crashing", () => {
    const error = fromBody(400, {
      errorCode: "VALIDATION_FAILED",
      fieldErrors: [
        null,
        "oops",
        { field: 3, message: "x" },
        { message: "no field" },
        { field: "ok", message: "fine" },
      ],
    });
    expect(error.fieldErrors).toEqual({ ok: "fine" });
    expect(
      fromBody(400, { errorCode: "VALIDATION_FAILED", fieldErrors: "bad" }).fieldErrors,
    ).toBeUndefined();
    expect(
      fromBody(400, { errorCode: "VALIDATION_FAILED", fieldErrors: { a: 1, b: "two" } })
        .fieldErrors,
    ).toEqual({ b: "two" });
  });

  it("OPTIMISTIC_LOCK / LOCK_TIMEOUT envelopes: 409, code kept, no fieldErrors", () => {
    for (const code of ["OPTIMISTIC_LOCK", "LOCK_TIMEOUT"]) {
      const error = fromBody(409, { success: false, errorCode: code, message: "retry" });
      expect(error).toMatchObject({ status: 409, code });
      expect(error.fieldErrors).toBeUndefined();
    }
  });

  it("keeps the per-field error codes of the array form for callers that branch on them", () => {
    const error = new AxiosError("Bad request", undefined, undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      data: {
        errorCode: "VALIDATION_FAILED",
        fieldErrors: [
          { field: "code", message: "cannot change", code: "VEHICLE_TYPE_CODE_IMMUTABLE" },
          { field: "name", message: "required" },
        ],
      },
      headers: {},
      status: 400,
      statusText: "Bad Request",
    });
    expect(ApiError.from(error).fieldCodes).toEqual({ code: "VEHICLE_TYPE_CODE_IMMUTABLE" });
    expect(new ApiError(400, "X", "m", { a: "b" }).fieldCodes).toBeUndefined();
  });

  it("keeps every entry of the array form, so several errors on one field are not lost", () => {
    const error = new AxiosError("Conflict", undefined, undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      data: {
        errorCode: "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
        fieldErrors: [
          { field: "orderNumber", message: "SO-1" },
          { field: "orderNumber", message: "SO-2" },
        ],
      },
      headers: {},
      status: 409,
      statusText: "Conflict",
    });
    const apiError = ApiError.from(error);
    // the map form keeps the first entry of a field; the list keeps them all
    expect(apiError.fieldErrors).toEqual({ orderNumber: "SO-1" });
    expect(apiError.fieldErrorList?.map((entry) => entry.message)).toEqual(["SO-1", "SO-2"]);
    expect(new ApiError(409, "X", "m", { a: "b" }).fieldErrorList).toBeUndefined();
  });
});
