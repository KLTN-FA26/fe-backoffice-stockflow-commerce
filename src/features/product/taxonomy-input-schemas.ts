/**
 * Input thương hiệu / danh mục — form gửi đi, nhắc lại luật của BE (`Create*Request`,
 * `Update*Request`, `ProductTaxonomyService`). BE vẫn re-check.
 */
import { z } from "zod";

import { TAXONOMY_LIMITS } from "@/constants/numbers";

/** Server trim + in hoa rồi mới kiểm mẫu → FE kiểm và gửi đúng giá trị đó. */
const normalizeCode = (v: string) => v.trim().toUpperCase();

/**
 * `@Pattern [A-Za-z0-9][A-Za-z0-9_-]{0,49}` + CHECK `ck_brands_code` / `ck_categories_code`
 * `^[A-Z0-9][A-Z0-9_-]{0,49}$`: server trim + in hoa rồi kiểm lại → FE kiểm trên đúng giá trị đó.
 * Bean Validation chạy trên chuỗi thô nên FE luôn gửi mã đã chuẩn hoá (không khoảng trắng thừa).
 */
export const TAXONOMY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,49}$/;
const INT32_MAX = 2_147_483_647;

export type TaxonomyFormMode = "create" | "edit";

const codeField = (mode: TaxonomyFormMode) =>
  mode === "create"
    ? z
        .string()
        .refine(
          (v) => TAXONOMY_CODE_PATTERN.test(normalizeCode(v)),
          "Mã gồm chữ, số, '_' hoặc '-', bắt đầu bằng chữ / số, tối đa 50 ký tự",
        )
    : // Mã bất biến (`updatable=false` + trigger `tg_categories_immutable`) — không gửi khi sửa
      z.string();

const nameField = z
  .string()
  .trim()
  .min(1, "Nhập tên")
  .max(TAXONOMY_LIMITS.nameMax, `Tên tối đa ${TAXONOMY_LIMITS.nameMax} ký tự`);

// BE lưu URL ảnh dạng TEXT, không kiểm định dạng → FE chỉ trim
const urlField = z.string().trim();

// `sortOrder` là Integer (cột INT) — để chuỗi trong form, rỗng = 0 phía BE
const sortOrderField = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^-?\d+$/.test(v) && Math.abs(Number(v)) <= INT32_MAX), {
    message: "Nhập số nguyên",
  });

export function makeBrandFormSchema(mode: TaxonomyFormMode) {
  return z.object({
    code: codeField(mode),
    name: nameField,
    logoUrl: urlField,
    active: z.boolean(),
  });
}
export type BrandFormValues = z.infer<ReturnType<typeof makeBrandFormSchema>>;

export function makeCategoryFormSchema(mode: TaxonomyFormMode) {
  return z.object({
    code: codeField(mode),
    /** Rỗng = danh mục gốc. Bất biến sau khi tạo (`parent_id` `updatable=false`). */
    parentId: z.string(),
    name: nameField,
    sortOrder: sortOrderField,
    imageUrl: urlField,
    seoTitle: z
      .string()
      .trim()
      .max(TAXONOMY_LIMITS.seoTitleMax, `Tiêu đề SEO tối đa ${TAXONOMY_LIMITS.seoTitleMax} ký tự`),
    seoDescription: z.string().trim(),
    active: z.boolean(),
  });
}
export type CategoryFormValues = z.infer<ReturnType<typeof makeCategoryFormSchema>>;

const optionalText = (v: string) => (v.trim() === "" ? undefined : v.trim());
const optionalInt = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** `CreateBrandRequest`. */
export function toBrandCreateRequest(v: BrandFormValues) {
  return { code: normalizeCode(v.code), name: v.name.trim(), logoUrl: optionalText(v.logoUrl) };
}

/**
 * `UpdateBrandRequest` — PUT thay TOÀN BỘ (`BrandJpaEntity.setDetails`): luôn gửi đủ field, ô bỏ
 * trống thành null = xoá giá trị đang lưu. `active` bắt buộc (@NotNull) — ngưng dùng thay cho xoá.
 */
export function toBrandUpdateRequest(v: BrandFormValues) {
  return { name: v.name.trim(), logoUrl: optionalText(v.logoUrl), active: v.active };
}

/** `CreateCategoryRequest` — luôn tạo `active=true`; `parentId` trống = gốc. */
export function toCategoryCreateRequest(v: CategoryFormValues) {
  return {
    code: normalizeCode(v.code),
    parentId: optionalText(v.parentId),
    name: v.name.trim(),
    sortOrder: optionalInt(v.sortOrder),
    imageUrl: optionalText(v.imageUrl),
    seoTitle: optionalText(v.seoTitle),
    seoDescription: optionalText(v.seoDescription),
  };
}

/** `UpdateCategoryRequest` — thay toàn bộ như thương hiệu; mã và cha không gửi (bất biến). */
export function toCategoryUpdateRequest(v: CategoryFormValues) {
  return {
    name: v.name.trim(),
    sortOrder: optionalInt(v.sortOrder),
    imageUrl: optionalText(v.imageUrl),
    seoTitle: optionalText(v.seoTitle),
    seoDescription: optionalText(v.seoDescription),
    active: v.active,
  };
}
