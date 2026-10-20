/**
 * Mutations thương hiệu / danh mục + invalidation map (api-conventions §2.3).
 *
 * - Tạo → chỉ danh sách của entity đó (gồm cả dropdown form sản phẩm, chung gốc khoá).
 * - Sửa thương hiệu → thêm sản phẩm: chi tiết / danh sách SP hiện `brandName` BE nhúng sẵn.
 * - Sửa danh mục → chỉ `categories`: danh sách SP, form SP, tab "Theo danh mục" tra tên từ đó.
 * - Lỗi do dữ liệu cũ (`isStaleTaxonomyError`) → tải lại danh sách rồi mới gọi onError của màn.
 * Lỗi map inline trong dialog nên tắt toast lỗi mặc định.
 */
import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { brandKeys, categoryKeys, productKeys } from "./queries";
import { createBrand, createCategory, updateBrand, updateCategory } from "./taxonomy-api";
import { isStaleTaxonomyError } from "./taxonomy-errors";

const TOAST = TOAST_MESSAGES.taxonomy;
const BRAND_LIST = [brandKeys.all] as const;
const CATEGORY_LIST = [categoryKeys.all] as const;

export const useCreateBrand = createMutation(createBrand, {
  invalidate: BRAND_LIST,
  showErrorToast: false,
  successMessage: TOAST.brandCreated,
});

export const useUpdateBrand = withStaleRefetch(
  createMutation(updateBrand, {
    invalidate: [brandKeys.all, productKeys.all],
    showErrorToast: false,
    successMessage: TOAST.brandUpdated,
  }),
  BRAND_LIST,
  isStaleTaxonomyError,
);

// CATEGORY_NOT_FOUND khi tạo = danh mục cha không còn → tải lại để ô chọn cha bỏ nó đi
export const useCreateCategory = withStaleRefetch(
  createMutation(createCategory, {
    invalidate: CATEGORY_LIST,
    showErrorToast: false,
    successMessage: TOAST.categoryCreated,
  }),
  CATEGORY_LIST,
  isStaleTaxonomyError,
);

export const useUpdateCategory = withStaleRefetch(
  createMutation(updateCategory, {
    invalidate: CATEGORY_LIST,
    showErrorToast: false,
    successMessage: TOAST.categoryUpdated,
  }),
  CATEGORY_LIST,
  isStaleTaxonomyError,
);
