/**
 * Listing TMĐT của sản phẩm — BE `CatalogManagementController`:
 *   GET/PUT /products/{id}/ecommerce                  slug + SEO, khoá lạc quan bằng `revision`
 * Không còn giá bán cơ sở (kltn-docs 13 BR-04, 01 §1): quy cách không có giá; giá của SKU riêng là bảng giá
 * riêng của khách (`/catalog/customer-prices`, feature `customer-price`).
 */

import { z } from "zod";

/** BE `ListingResponse`. */
export const beListingSchema = z.object({
  productId: z.string(),
  slug: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  /** Gửi lại khi sửa listing (lệch → 409 CONFLICT). */
  revision: z.number().int().min(0),
  projectedRevision: z.number().int(),
  published: z.boolean(),
  /** Bản hiển thị công khai chưa bắt kịp `revision` — thay đổi sắp có hiệu lực. */
  projectionPending: z.boolean(),
});
export type Listing = z.infer<typeof beListingSchema>;

/** `EditListingRequest`: slug ≤ 300 (sau chuẩn hoá ≤ 255), SEO title ≤ 255, SEO description ≤ 5000. */
export const LISTING_LIMITS = {
  slug: 300,
  slugNormalized: 255,
  seoTitle: 255,
  seoDescription: 5000,
} as const;

/**
 * BE `Listing.normalizeSlug`: chữ thường, bỏ dấu (đ → d), mọi chuỗi không phải a-z0-9 thành một '-',
 * cắt '-' hai đầu. Slug sau chuẩn hoá phải khác rỗng và ≤ 255.
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const listingFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Nhập đường dẫn (slug)")
    .max(LISTING_LIMITS.slug, `Tối đa ${LISTING_LIMITS.slug} ký tự`)
    .refine((v) => normalizeSlug(v).length > 0, "Đường dẫn phải có chữ hoặc số")
    .refine(
      (v) => normalizeSlug(v).length <= LISTING_LIMITS.slugNormalized,
      `Sau chuẩn hoá tối đa ${LISTING_LIMITS.slugNormalized} ký tự`,
    ),
  seoTitle: z
    .string()
    .trim()
    .max(LISTING_LIMITS.seoTitle, `Tối đa ${LISTING_LIMITS.seoTitle} ký tự`),
  seoDescription: z
    .string()
    .trim()
    .max(LISTING_LIMITS.seoDescription, `Tối đa ${LISTING_LIMITS.seoDescription} ký tự`),
});
export type ListingFormValues = z.infer<typeof listingFormSchema>;
