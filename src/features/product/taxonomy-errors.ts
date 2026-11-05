/**
 * Lỗi BE của thương hiệu / danh mục (`ProductTaxonomyService`) → câu tiếng Việt, gắn vào đúng ô
 * của form khi được. Business error chỉ có `errorCode` + message tiếng Anh; lỗi Bean Validation
 * có `fieldErrors` theo tên field của request.
 */
import { TAXONOMY_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import type { TaxonomyFormMode } from "./taxonomy-input-schemas";

const M = TAXONOMY_ERROR_MESSAGES;

export const TAXONOMY_FORM_FIELDS = [
  "code",
  "parentId",
  "name",
  "logoUrl",
  "sortOrder",
  "imageUrl",
  "seoTitle",
  "seoDescription",
] as const;
export type TaxonomyFormField = (typeof TAXONOMY_FORM_FIELDS)[number];

export interface TaxonomyFormError {
  /** Ô nhận lỗi; không có = lỗi chung của dialog. */
  field?: TaxonomyFormField;
  message: string;
}

const isFormField = (key: string): key is TaxonomyFormField =>
  (TAXONOMY_FORM_FIELDS as readonly string[]).includes(key);

// `ProductTaxonomyService.createCategory`: cha có depth ≥ 10 → VALIDATION_FAILED không fieldErrors
const MAX_DEPTH_MESSAGE = /levels deep/i;

export function taxonomyFormError(error: unknown, mode: TaxonomyFormMode): TaxonomyFormError {
  if (!(error instanceof ApiError)) return { message: M.generic };
  switch (error.code) {
    case "BRAND_CODE_ALREADY_EXISTS":
    case "CATEGORY_CODE_ALREADY_EXISTS":
      return { field: "code", message: M[error.code] };
    case "CATEGORY_NOT_FOUND":
      // Khi tạo, danh mục duy nhất được tra là cha (`requireCategory(parentId)`)
      return mode === "create"
        ? { field: "parentId", message: M.PARENT_NOT_FOUND }
        : { message: M.CATEGORY_NOT_FOUND };
    case "BRAND_NOT_FOUND":
    case "OPTIMISTIC_LOCK":
    case "UNSUPPORTED_PARAMETER":
    case "NETWORK_ERROR":
      return { message: M[error.code] };
    case "VALIDATION_FAILED": {
      if (MAX_DEPTH_MESSAGE.test(error.message)) return { field: "parentId", message: M.MAX_DEPTH };
      const field = Object.keys(error.fieldErrors ?? {}).find(isFormField);
      return field ? { field, message: M.VALIDATION_FAILED } : { message: M.VALIDATION_FAILED };
    }
    default:
      return { message: error.status === 403 ? M.FORBIDDEN : M.generic };
  }
}

/**
 * Câu cho trạng thái lỗi khi TẢI danh sách — không dùng câu của form (vd "danh sách đã được tải
 * lại") vì ở đây chưa có gì được tải lại.
 */
export function taxonomyErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return M.LOAD_FAILED;
  if (error.code === "NETWORK_ERROR" || error.code === "UNSUPPORTED_PARAMETER") {
    return M[error.code];
  }
  return error.status === 403 ? M.FORBIDDEN : M.LOAD_FAILED;
}

/**
 * Dữ liệu đang hiển thị đã cũ: bị sửa cùng lúc (`OPTIMISTIC_LOCK`) hoặc không còn (NOT_FOUND, kể cả
 * danh mục cha khi tạo) → mutation tải lại danh sách để lần mở lại thấy bản mới nhất.
 */
export function isStaleTaxonomyError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["OPTIMISTIC_LOCK", "BRAND_NOT_FOUND", "CATEGORY_NOT_FOUND"].includes(error.code)
  );
}
