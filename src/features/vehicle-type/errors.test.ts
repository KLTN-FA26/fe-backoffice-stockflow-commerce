import { describe, expect, it } from "vitest";

import {
  VEHICLE_TYPE_ERROR_MESSAGES as MESSAGES,
  VEHICLE_TYPE_FIELD_MESSAGES as FIELD,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { doorFieldMessage, isStaleVehicleTypeError, vehicleTypeErrorMessage } from "./errors";

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

  it("VALIDATION_FAILED nêu nhãn tiếng Việt của ô kèm câu BE đã dịch cho ô đó", () => {
    expect(
      vehicleTypeErrorMessage(
        err(400, "VALIDATION_FAILED", { innerLengthMm: "Từ 1 đến 30000 mm" }),
      ),
    ).toBe("Dài trong (mm): Từ 1 đến 30000 mm");
    expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED"))).toBe(MESSAGES.VALIDATION_FAILED);
    // Trường BE lạ: vẫn không vỡ, nêu nguyên tên trường
    expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { weird: "x" }))).toContain(
      "weird",
    );
  });

  describe("mã và loại: chỉ nói 'không đổi được' khi đúng là vậy", () => {
    const withCodes = (fieldErrors: Record<string, string>, fieldCodes: Record<string, string>) =>
      new ApiError(400, "VALIDATION_FAILED", "m", fieldErrors, undefined, fieldCodes);

    it("mã trường của BE nói bất biến → không đổi được (mã, loại)", () => {
      expect(
        vehicleTypeErrorMessage(
          withCodes({ code: "cannot be changed" }, { code: "VEHICLE_TYPE_CODE_IMMUTABLE" }),
        ),
      ).toBe(MESSAGES.VALIDATION_CODE_IMMUTABLE);
      expect(
        vehicleTypeErrorMessage(
          withCodes({ kind: "a preset keeps its kind" }, { kind: "VEHICLE_TYPE_KIND_IMMUTABLE" }),
        ),
      ).toBe(MESSAGES.VALIDATION_KIND_IMMUTABLE);
    });

    it("sửa loại xe mặc định: lỗi trên code / kind là không đổi được dù BE không kèm mã", () => {
      const ctx = { updatingPreset: true };
      expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { code: "x" }), ctx)).toBe(
        MESSAGES.VALIDATION_CODE_IMMUTABLE,
      );
      expect(vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { kind: "x" }), ctx)).toBe(
        MESSAGES.VALIDATION_KIND_IMMUTABLE,
      );
    });

    it("mã sai định dạng khi thêm mới: hiện câu của BE, không phải 'không đổi được'", () => {
      const invalidCode = withCodes(
        { code: "Mã gồm 2-32 ký tự" },
        { code: "VEHICLE_TYPE_CODE_INVALID" },
      );
      expect(vehicleTypeErrorMessage(invalidCode)).toBe("Mã loại xe: Mã gồm 2-32 ký tự");
      // Sửa loại xe tự thêm (không phải mặc định) với lỗi định dạng cũng vậy
      expect(vehicleTypeErrorMessage(invalidCode, { updatingPreset: false })).toBe(
        "Mã loại xe: Mã gồm 2-32 ký tự",
      );
      expect(
        vehicleTypeErrorMessage(
          err(400, "VALIDATION_FAILED", { kind: "CONTAINER, TRUCK hoặc PICKUP" }),
        ),
      ).toBe("Loại: CONTAINER, TRUCK hoặc PICKUP");
    });
  });
});

describe("lỗi trường cửa thùng (BE PR #158)", () => {
  const door = (fieldErrors: Record<string, string>, fieldCodes: Record<string, string>) =>
    new ApiError(400, "VALIDATION_FAILED", "m", fieldErrors, undefined, fieldCodes);

  it("doorFieldMessage rẽ nhánh theo mã trường và theo ô rộng / cao", () => {
    expect(doorFieldMessage("doorWidthMm", "VEHICLE_TYPE_DOOR_INVALID")).toBe(FIELD.doorInvalid);
    expect(doorFieldMessage("doorHeightMm", "VEHICLE_TYPE_DOOR_INVALID")).toBe(FIELD.doorInvalid);
    expect(doorFieldMessage("doorWidthMm", "VEHICLE_TYPE_DOOR_TOO_LARGE")).toBe(
      FIELD.doorTooLargeForWidth,
    );
    expect(doorFieldMessage("doorHeightMm", "VEHICLE_TYPE_DOOR_TOO_LARGE")).toBe(
      FIELD.doorTooLargeForHeight,
    );
  });

  it("mã lạ, thiếu mã hoặc ô khác → undefined để dùng câu BE", () => {
    expect(doorFieldMessage("doorWidthMm", undefined)).toBeUndefined();
    expect(doorFieldMessage("doorWidthMm", "SOMETHING_ELSE")).toBeUndefined();
    expect(doorFieldMessage("innerWidthMm", "VEHICLE_TYPE_DOOR_TOO_LARGE")).toBeUndefined();
    expect(doorFieldMessage(undefined, "VEHICLE_TYPE_DOOR_INVALID")).toBeUndefined();
  });

  it("VALIDATION_FAILED nêu nhãn ô cửa kèm câu tiếng Việt, không lộ câu tiếng Anh của BE", () => {
    expect(
      vehicleTypeErrorMessage(
        door(
          { doorHeightMm: "must not be larger than the inner height" },
          { doorHeightMm: "VEHICLE_TYPE_DOOR_TOO_LARGE" },
        ),
      ),
    ).toBe(`Cửa cao (mm): ${FIELD.doorTooLargeForHeight}`);
    expect(
      vehicleTypeErrorMessage(
        door({ doorWidthMm: "1 to 30000 mm" }, { doorWidthMm: "VEHICLE_TYPE_DOOR_INVALID" }),
      ),
    ).toBe(`Cửa rộng (mm): ${FIELD.doorInvalid}`);
  });

  it("không có mã trường (BE trả dạng bản đồ): dùng câu BE đã dịch cho ô đó", () => {
    expect(
      vehicleTypeErrorMessage(err(400, "VALIDATION_FAILED", { doorWidthMm: "Từ 1 đến 30000 mm" })),
    ).toBe("Cửa rộng (mm): Từ 1 đến 30000 mm");
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
