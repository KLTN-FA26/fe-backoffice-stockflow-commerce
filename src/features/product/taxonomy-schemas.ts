/**
 * Thương hiệu / danh mục — DTO đúng `BrandResponse` / `CategoryResponse` của BE
 * (`ProductTaxonomyController`). BE bỏ field null khỏi JSON (`non_null`) nên field tuỳ chọn là
 * `.nullish()`. Bản đầy đủ cho màn quản lý (có ảnh, SEO, `version`); dropdown form sản phẩm dùng
 * bản rút gọn trong `schemas.ts`.
 */
import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";

/** `BrandResponse`. */
export const beBrandSchema = z.object({
  brandId: z.string(),
  code: z.string(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullish(),
  active: z.boolean(),
  // Có trong response nhưng PUT không nhận version (BE không khoá lạc quan ở form này)
  version: z.number().int().optional(),
});

/** `CategoryResponse` — một nút của cây: `path` dạng `/GOC/CON`, `depth` 0 là gốc. */
export const beCategorySchema = z.object({
  categoryId: z.string(),
  parentId: z.string().nullish(),
  code: z.string(),
  name: z.string(),
  slug: z.string(),
  path: z.string(),
  depth: z.number().int().min(0),
  sortOrder: z.number().int(),
  imageUrl: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  active: z.boolean(),
  version: z.number().int().optional(),
});

export const beBrandPageSchema = bePageSchema(beBrandSchema);
export const beCategoryPageSchema = bePageSchema(beCategorySchema);

export type Brand = z.infer<typeof beBrandSchema>;
export type BrandPage = z.infer<typeof beBrandPageSchema>;
export type CategoryNode = z.infer<typeof beCategorySchema>;
export type CategoryNodePage = z.infer<typeof beCategoryPageSchema>;

/** Mã danh mục cha lấy từ `path` (đoạn áp chót) — không cần tra thêm danh sách. */
export function parentCodeOf(category: Pick<CategoryNode, "path">): string | null {
  const segments = category.path.split("/").filter(Boolean);
  return segments.length > 1 ? (segments[segments.length - 2] ?? null) : null;
}
