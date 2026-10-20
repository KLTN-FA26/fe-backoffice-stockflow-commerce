import { describe, expect, it } from "vitest";

import { TAXONOMY_ERROR_MESSAGES as M } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleTaxonomyError, taxonomyErrorMessage, taxonomyFormError } from "./taxonomy-errors";

const apiError = (
  status: number,
  code: string,
  message = "English message from BE",
  fieldErrors?: Record<string, string>,
) => new ApiError(status, code, message, fieldErrors);

describe("taxonomyFormError", () => {
  it("trùng mã / slug → ô mã, không lộ message tiếng Anh", () => {
    expect(taxonomyFormError(apiError(409, "BRAND_CODE_ALREADY_EXISTS"), "create")).toEqual({
      field: "code",
      message: M.BRAND_CODE_ALREADY_EXISTS,
    });
    expect(taxonomyFormError(apiError(409, "CATEGORY_CODE_ALREADY_EXISTS"), "create")).toEqual({
      field: "code",
      message: M.CATEGORY_CODE_ALREADY_EXISTS,
    });
  });

  it("CATEGORY_NOT_FOUND khi tạo = cha không còn; khi sửa = chính danh mục", () => {
    expect(taxonomyFormError(apiError(404, "CATEGORY_NOT_FOUND"), "create")).toEqual({
      field: "parentId",
      message: M.PARENT_NOT_FOUND,
    });
    expect(taxonomyFormError(apiError(404, "CATEGORY_NOT_FOUND"), "edit")).toEqual({
      message: M.CATEGORY_NOT_FOUND,
    });
  });

  it("cây quá 11 cấp → ô danh mục cha", () => {
    const error = apiError(400, "VALIDATION_FAILED", "The category tree is at most 11 levels deep");
    expect(taxonomyFormError(error, "create")).toEqual({
      field: "parentId",
      message: M.MAX_DEPTH,
    });
  });

  it("VALIDATION_FAILED có fieldErrors → ô tương ứng; field lạ → lỗi chung", () => {
    expect(
      taxonomyFormError(
        apiError(400, "VALIDATION_FAILED", "x", { seoTitle: "seoTitle must be at most 255" }),
        "edit",
      ),
    ).toEqual({ field: "seoTitle", message: M.VALIDATION_FAILED });
    expect(
      taxonomyFormError(apiError(400, "VALIDATION_FAILED", "x", { other: "bad" }), "edit"),
    ).toEqual({ message: M.VALIDATION_FAILED });
  });

  it("403 / mã lạ / lỗi không phải ApiError", () => {
    expect(taxonomyFormError(apiError(403, "FORBIDDEN"), "create").message).toBe(M.FORBIDDEN);
    expect(taxonomyFormError(apiError(500, "SOMETHING_NEW"), "create").message).toBe(M.generic);
    expect(taxonomyFormError(new Error("boom"), "create").message).toBe(M.generic);
    expect(taxonomyErrorMessage(apiError(0, "NETWORK_ERROR"))).toBe(M.NETWORK_ERROR);
  });

  it("lỗi khi TẢI danh sách không dùng câu 'đã tải lại' của form", () => {
    expect(taxonomyErrorMessage(apiError(404, "CATEGORY_NOT_FOUND"))).toBe(M.LOAD_FAILED);
    expect(taxonomyErrorMessage(apiError(409, "OPTIMISTIC_LOCK"))).toBe(M.LOAD_FAILED);
    expect(taxonomyErrorMessage(apiError(403, "FORBIDDEN"))).toBe(M.FORBIDDEN);
    expect(taxonomyErrorMessage(new Error("boom"))).toBe(M.LOAD_FAILED);
  });
});

describe("isStaleTaxonomyError — lỗi cần tải lại danh sách", () => {
  it("sửa cùng lúc / không còn bản ghi → tải lại; trùng mã / validation thì không", () => {
    expect(isStaleTaxonomyError(apiError(409, "OPTIMISTIC_LOCK"))).toBe(true);
    expect(isStaleTaxonomyError(apiError(404, "BRAND_NOT_FOUND"))).toBe(true);
    expect(isStaleTaxonomyError(apiError(404, "CATEGORY_NOT_FOUND"))).toBe(true);
    expect(isStaleTaxonomyError(apiError(409, "BRAND_CODE_ALREADY_EXISTS"))).toBe(false);
    expect(isStaleTaxonomyError(apiError(400, "VALIDATION_FAILED"))).toBe(false);
    expect(isStaleTaxonomyError(new Error("boom"))).toBe(false);
  });
});
