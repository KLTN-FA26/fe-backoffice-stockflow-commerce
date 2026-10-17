/**
 * Listing TMĐT và giá bán cơ sở của sản phẩm — BE `CatalogManagementController`:
 *   GET/PUT /products/{id}/ecommerce                  slug + SEO, khoá lạc quan bằng `revision`
 *   GET/PUT /products/{id}/skus/{sku}/base-price      giá VND theo MÃ SKU (không phải variantId)
 * Thứ tự bắt buộc của BE: lưu listing trước (409 CATALOG_LISTING_REQUIRED nếu chưa), rồi đặt giá; mọi
 * SKU phải có giá trước khi xuất bản (409 PRICE_NOT_AVAILABLE).
 */

import { z } from "zod";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `ListingResponse`. */
export const beListingSchema = z.object({
  productId: z.string(),
  slug: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  /** Gửi lại khi sửa listing và khi đặt giá (lệch → 409 CONFLICT). */
  revision: z.number().int().min(0),
  projectedRevision: z.number().int(),
  published: z.boolean(),
  /** Bản hiển thị công khai chưa bắt kịp `revision` — thay đổi sắp có hiệu lực. */
  projectionPending: z.boolean(),
});
export type Listing = z.infer<typeof beListingSchema>;

/** BE `SkuPriceResponse` — `null` khi SKU chưa có giá. */
export const beSkuPriceSchema = z.object({
  sku: z.string(),
  revision: z.number().int().min(0),
  basePrice: beDecimal.nullish(),
  baseCurrency: z.string().nullish(),
  effectivePrice: beDecimal.nullish(),
  effectiveCurrency: z.string().nullish(),
});
export type SkuPrice = z.infer<typeof beSkuPriceSchema>;

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

/**
 * `SetBasePriceRequest` + `SellingPrice`: giá VND là số nguyên dương (BE không làm tròn giá đã thoả
 * thuận), tối đa 16 chữ số. Tiền tệ cố định "VND".
 */
export const BASE_PRICE_CURRENCY = "VND";
export const basePriceFormSchema = z.object({
  price: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,15}$/, "Nhập số nguyên VND lớn hơn 0 (tối đa 16 chữ số)"),
});
export type BasePriceFormValues = z.infer<typeof basePriceFormSchema>;
