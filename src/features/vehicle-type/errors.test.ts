import { describe, expect, it } from "vitest";

import { VEHICLE_TYPE_ERROR_MESSAGES as MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleVehicleTypeError, vehicleTypeErrorMessage } from "./errors";

const err = (status: number, code: string, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "English message from BE", fieldErrors);

describe("vehicleTypeErrorMessage — mọi errorCode của BE PR #153", () => {
  it.each([
    [err(404, "VEHICLE_TYPE_NOT_FOUND"), MESSAGES.VEHICLE_TYPE_NOT_FOUND],
    [err(409, "VEHICLE_TYPE_CODE_EXISTS"), MESSAGES.VEHICLE_TYPE_CODE_EXISTS],
    [err(409, "OPTIMISTIC_LOCK"), MESSAGES.OPTIMISTIC_LOCK],
    [err(403, "FORBIDDEN"), MESSAGES.FORBIDDEN],
    [err(403, "SOMETHING_ELSE"), MESSAGES.FORBIDDEN],
    [err(500, "INTERNAL"), MESSAGES.generic],
    [err(0, "NETWORK_ERROR"), MESSAGES.generic],
    [new Error("boom"), MESSAGES.generic],
  ])("%#", (error, expected) => {
    expect(vehicleTypeErrorMessage(error)).toBe(expected);
  });

  it("câu tiếng Việt, không lộ message tiếng Anh của BE", () => {
    for (const code of ["VEHICLE_TYPE_NOT_FOUND", "VEHICLE_TYPE_CODE_EXISTS", "OPTIMISTIC_LOCK"]) {
      expect(vehicleTypeErrorMessage(err(409, code))).not.toContain("English");
    }
  });

  it("VALIDATION_FAILED nêu tên ô cần sửa bằng nhãn tiếng Việt", () => {
    expect(
      vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { innerLengthMm: "1 to 30000 mm" })),
    ).toBe("Dữ liệu chưa hợp lệ. (Dài trong (mm))");
    expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED"))).toBe(MESSAGES.VALIDATION_FAILED);
    // Trường BE lạ: vẫn không vỡ, nêu nguyên tên trường
    expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { weird: "x" }))).toContain(
      "weird",
    );
  });

  it("PUT với mã khác (400 trên trường code) → mã không đổi được", () => {
    expect(
      vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { code: "cannot be changed" })),
    ).toBe(MESSAGES.VALIDATION_CODE_IMMUTABLE);
  });
});

describe("isStaleVehicleTypeError", () => {
  it("OPTIMISTIC_LOCK và VEHICLE_TYPE_NOT_FOUND là dữ liệu cũ → tải lại", () => {
    expect(isStaleVehicleTypeError(err(409, "OPTIMISTIC_LOCK"))).toBe(true);
    expect(isStaleVehicleTypeError(err(404, "VEHICLE_TYPE_NOT_FOUND"))).toBe(true);
  });
  it("lỗi khác thì không", () => {
    expect(isStaleVehicleTypeError(err(409, "VEHICLE_TYPE_CODE_EXISTS"))).toBe(false);
    expect(isStaleVehicleTypeError(err(400, "VALIDATION_FAILED"))).toBe(false);
    expect(isStaleVehicleTypeError(new Error("x"))).toBe(false);
  });
});
