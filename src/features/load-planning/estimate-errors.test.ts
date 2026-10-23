import { describe, expect, it } from "vitest";

import { LOAD_ESTIMATE_ERROR_MESSAGES as MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { estimateErrorMessage, packagingMissingItemIds } from "./estimate-errors";

const error = (
  status: number,
  code: string,
  fieldErrors?: Record<string, string>,
  fieldCodes?: Record<string, string>,
) => new ApiError(status, code, "English server message", fieldErrors, "trace-1", fieldCodes);

const VIETNAMESE = /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i;

describe("estimateErrorMessage — mọi mã BE của PR #160 có câu tiếng Việt", () => {
  it.each([
    [422, "LOAD_ESTIMATE_PACKAGING_MISSING"],
    [422, "LOAD_ESTIMATE_TOO_MANY_CARTONS"],
    [409, "LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE"],
    [400, "LOAD_ESTIMATE_SOURCE_UNSUPPORTED"],
    [404, "LOAD_ESTIMATE_NOT_FOUND"],
    [409, "VEHICLE_TYPE_INACTIVE"],
    [404, "VEHICLE_TYPE_NOT_FOUND"],
    [404, "NOT_FOUND"],
    [403, "OUT_OF_DATA_SCOPE"],
    [403, "FORBIDDEN"],
    [0, "NETWORK_ERROR"],
  ] as const)("%s %s → câu riêng, không lộ message tiếng Anh", (status, code) => {
    const message = estimateErrorMessage(error(status, code));
    expect(message).toBe(MESSAGES[code]);
    expect(message).not.toContain("English");
    expect(message).toMatch(VIETNAMESE);
  });

  it("VALIDATION_FAILED rẽ theo mã của ô: kho bắt buộc / khác kho đơn / kho ngừng / không có loại xe", () => {
    const field = (name: string, code: string) =>
      estimateErrorMessage(error(400, "VALIDATION_FAILED", { [name]: "x" }, { [name]: code }));
    expect(field("warehouseId", "NotNull")).toBe(MESSAGES.WAREHOUSE_REQUIRED);
    expect(field("warehouseId", "WarehouseMismatch")).toBe(MESSAGES.WAREHOUSE_MISMATCH);
    expect(field("warehouseId", "WarehouseInactive")).toBe(MESSAGES.WAREHOUSE_INACTIVE);
    expect(field("vehicleTypeIds", "NotEmpty")).toBe(MESSAGES.NO_ACTIVE_VEHICLE_TYPE);
    expect(estimateErrorMessage(error(400, "VALIDATION_FAILED"))).toBe(MESSAGES.VALIDATION_FAILED);
  });

  it("403 mã lạ → không có quyền; mã lạ khác và lỗi không phải ApiError → câu chung", () => {
    expect(estimateErrorMessage(error(403, "SOMETHING"))).toBe(MESSAGES.FORBIDDEN);
    expect(estimateErrorMessage(error(500, "HTTP_500"))).toBe(MESSAGES.generic);
    expect(estimateErrorMessage(new Error("boom"))).toBe(MESSAGES.generic);
  });
});

describe("packagingMissingItemIds", () => {
  it("lấy id mặt hàng từ lỗi trường inventoryItems[<id>] của 422", () => {
    const ids = packagingMissingItemIds(
      error(422, "LOAD_ESTIMATE_PACKAGING_MISSING", {
        "inventoryItems[item-1]": "lengthCm is empty",
        "inventoryItems[item-2]": "weightKg is empty",
        other: "x",
      }),
    );
    expect(ids).toEqual(["item-1", "item-2"]);
  });

  it("lỗi khác hoặc không phải ApiError → rỗng", () => {
    expect(
      packagingMissingItemIds(error(409, "VEHICLE_TYPE_INACTIVE", { "inventoryItems[a]": "x" })),
    ).toEqual([]);
    expect(packagingMissingItemIds(new Error("x"))).toEqual([]);
  });
});
