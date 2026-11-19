import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { cartonLoadError, cartonSaveError, isStaleCartonError } from "./carton-errors";

const E = UI_LABELS.cartonSpec.error;
const V = UI_LABELS.cartonSpec.validation;

describe("cartonLoadError", () => {
  it("403 / không có hồ sơ / 404 không thử lại; còn lại thử lại", () => {
    expect(cartonLoadError(new ApiError(403, "FORBIDDEN", "x"))).toEqual({
      message: E.forbidden,
      retryable: false,
    });
    expect(cartonLoadError(new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "x")).message).toBe(
      E.noItem,
    );
    expect(cartonLoadError(new ApiError(404, "NOT_FOUND", "x")).message).toBe(E.notFound);
    expect(cartonLoadError(new Error("zod"))).toEqual({ message: E.loadFailed, retryable: true });
  });
});

describe("cartonSaveError (BE SkuUnitService / UomConversionRules)", () => {
  it("mã trùng → báo ở ô mã đơn vị", () => {
    expect(cartonSaveError(new ApiError(409, "UOM_CONVERSION_DUPLICATE", "x"))).toEqual({
      fields: { unitOfMeasure: E.duplicate },
      message: null,
    });
  });

  it("409 nghiệp vụ → một câu chung", () => {
    for (const [code, message] of [
      ["OPTIMISTIC_LOCK", E.versionConflict],
      ["UOM_CONVERSION_IN_USE", E.inUse],
      ["CARTONS_WOULD_NOT_FIT", E.wouldNotFit],
      ["CONFLICT", E.productLocked],
      ["VARIANT_OBSOLETE", E.variantObsolete],
    ] as const) {
      expect(cartonSaveError(new ApiError(409, code, "x"))).toEqual({ fields: {}, message });
    }
  });

  it("VALIDATION_FAILED theo field → câu tiếng Việt ở đúng ô; field lạ → câu chung", () => {
    expect(
      cartonSaveError(
        new ApiError(400, "VALIDATION_FAILED", "x", { factor: "factor must be at least 1" }),
      ),
    ).toEqual({ fields: { unitsPerCarton: V.unitsPerCarton }, message: null });
    expect(
      cartonSaveError(new ApiError(400, "VALIDATION_FAILED", "x", { version: "required" })),
    ).toEqual({ fields: {}, message: E.invalid });
  });

  it("403 / không phải ApiError", () => {
    expect(cartonSaveError(new ApiError(403, "FORBIDDEN", "x")).message).toBe(E.forbidden);
    expect(cartonSaveError(new Error("network")).message).toBe(E.unexpected);
  });
});

describe("isStaleCartonError", () => {
  it("dữ liệu cũ → tải lại; lỗi nhập liệu thì không", () => {
    expect(isStaleCartonError(new ApiError(409, "OPTIMISTIC_LOCK", "x"))).toBe(true);
    expect(isStaleCartonError(new ApiError(409, "CONFLICT", "x"))).toBe(true);
    expect(isStaleCartonError(new ApiError(400, "VALIDATION_FAILED", "x"))).toBe(false);
    expect(isStaleCartonError(new ApiError(409, "UOM_CONVERSION_DUPLICATE", "x"))).toBe(false);
  });
});
