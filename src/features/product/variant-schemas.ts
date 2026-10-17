/**
 * Biến thể, logistics theo SKU và ảnh theo biến thể — hợp đồng BE PR #71:
 *  - `GET/POST/PUT /products/{id}/variants`, `/{variantId}/activation | blocking | obsoletion`
 *  - `GET/PUT /products/{id}/skus/{variantId}/logistics` (variantId là skuId)
 *  - `/products/{id}/variants/{variantId}/media` (tải lên multipart, xuất bản bốn mắt)
 * Ảnh và kích thước / khối lượng không còn trên dòng sản phẩm.
 */

import { z } from "zod";

import { optionalSkuSchema, SKU_INPUT_PATTERN, skuSchema } from "@/lib/validation/sku";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

export const VARIANT_STATUSES = ["DRAFT", "ACTIVE", "BLOCKED", "OBSOLETE"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

/** BE `StorageClass` (inventory :: api). */
export const STORAGE_CLASSES = ["NORMAL", "COLD", "HAZMAT", "FRAGILE", "OVERSIZE"] as const;
export type StorageClass = (typeof STORAGE_CLASSES)[number];

/** BE `VariantOptionResponse` — giá trị một trục (màu, cỡ…) mà biến thể mang. */
export const beVariantOptionSchema = z.object({
  attributeId: z.string(),
  attributeCode: z.string(),
  valueId: z.string(),
  valueCode: z.string(),
  label: z.string(),
});
export type VariantOption = z.infer<typeof beVariantOptionSchema>;

/** BE `VariantResponse`. */
export const beVariantSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  status: z.enum(VARIANT_STATUSES),
  defaultVariant: z.boolean(),
  attributeSignature: z.string().nullish(),
  position: z.number().int(),
  obsoletedAt: z.string().nullish(),
  version: z.number().int(),
  /** Một phần tử cho mỗi trục của sản phẩm; rỗng với sản phẩm không có trục. */
  options: z.array(beVariantOptionSchema).default([]),
});
export type Variant = z.infer<typeof beVariantSchema>;

/** Nhãn tuỳ chọn của biến thể ("Trắng / 12oz"); "—" với biến thể không có trục. */
export function variantOptionsLabel(variant: Pick<Variant, "options">): string {
  return variant.options.length > 0 ? variant.options.map((o) => o.label).join(" / ") : "—";
}

/**
 * Trục của sản phẩm (`GET /products/{id}/attributes`) — định nghĩa ở `axes-schemas.ts`; re-export để
 * các nơi chọn tuỳ chọn khi thêm biến thể giữ nguyên đường import.
 */
export type { ProductAxis, ProductAxisOption } from "./axes-schemas";

/** BE `GeneratedVariantsResponse` — biến thể vừa tạo và số tổ hợp đã có sẵn (bị bỏ qua). */
export const beGeneratedVariantsSchema = z.object({
  created: z.array(beVariantSchema),
  skipped: z.number().int().min(0),
});
export type GeneratedVariants = z.infer<typeof beGeneratedVariantsSchema>;

/** BE `SkuLogisticsResponse` — kích thước / khối lượng là `null` khi chưa biết. */
export const beSkuLogisticsSchema = z.object({
  skuId: z.string(),
  sku: z.string(),
  version: z.number().int(),
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
  weightKg: beDecimal.nullish(),
  lengthCm: beDecimal.nullish(),
  widthCm: beDecimal.nullish(),
  heightCm: beDecimal.nullish(),
  packageWeightKg: beDecimal.nullish(),
  packageLengthCm: beDecimal.nullish(),
  packageWidthCm: beDecimal.nullish(),
  packageHeightCm: beDecimal.nullish(),
  packageCount: z.number().int(),
  packSize: z.number().int(),
  storageClass: z.enum(STORAGE_CLASSES),
  requiresAdultSignature: z.boolean(),
  shippingRestrictionNote: z.string().nullish(),
  qcRequired: z.boolean(),
});
export type SkuLogistics = z.infer<typeof beSkuLogisticsSchema>;

/** BE `MediaResponse` — bản gốc riêng tư, xem qua `download-url` có hạn. */
export const beMediaSchema = z.object({
  mediaId: z.string(),
  variantId: z.string(),
  kind: z.string(),
  url: z.string().nullish(),
  originalName: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  storedAt: z.string().nullish(),
  renditions: z
    .array(
      z.object({
        edge: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
        contentType: z.string(),
        sizeBytes: z.number(),
      }),
    )
    .default([]),
  altText: z.string().nullish(),
  sortOrder: z.number().int(),
  primary: z.boolean(),
  published: z.boolean(),
  publishedAt: z.string().nullish(),
  publishedBy: z.string().nullish(),
  uploadedBy: z.string().nullish(),
  uploadedAt: z.string().nullish(),
  version: z.number().int(),
});
export type VariantMedia = z.infer<typeof beMediaSchema>;

/** BE `ImageDownloadResponse`. */
export const beDownloadUrlSchema = z.object({ url: z.string(), expiresAt: z.string() });

/* ── Input ───────────────────────────────────────────────────────────── */

/** BE `VariantRequest.sku` — `@ValidSku`, mẫu duy nhất ở `lib/validation/sku.ts`. */
export const VARIANT_SKU_PATTERN = SKU_INPUT_PATTERN;

/**
 * BE `VariantRequest` (PR #115/#116): sản phẩm CÓ trục → bắt buộc đúng một giá trị mỗi trục
 * (`optionValueIds`), `sku` và `name` tuỳ chọn (BE sinh SKU theo quy tắc mã, tên theo tuỳ chọn).
 * Sản phẩm KHÔNG có trục → `sku` và `name` bắt buộc, không có tuỳ chọn. Số trục lấy từ
 * `GET /products/{id}/attributes`, nên schema dựng theo `axisCount`.
 */
export function variantInputSchemaFor(axisCount: number) {
  const hasAxes = axisCount > 0;
  return z.object({
    sku: hasAxes ? optionalSkuSchema() : skuSchema(),
    name: hasAxes
      ? z.string().trim().max(255, "Tên tối đa 255 ký tự")
      : z.string().trim().min(1, "Nhập tên biến thể").max(255, "Tên tối đa 255 ký tự"),
    optionValueIds: z
      .array(z.string().min(1))
      .length(
        axisCount,
        hasAxes ? "Chọn đủ giá trị cho mọi thuộc tính" : "Sản phẩm không có thuộc tính",
      ),
  });
}
/** Sản phẩm không có trục (mặc định khi chưa biết). */
export const variantInputSchema = variantInputSchemaFor(0);
export type VariantInput = z.infer<typeof variantInputSchema>;

const optionalPositive = z
  .string()
  .trim()
  .refine((v) => v === "" || Number(v) > 0, "Phải lớn hơn 0");
const optionalCount = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1), "Số nguyên ≥ 1");

/** Form logistics — chuỗi người dùng gõ; chuyển sang `SkuLogisticsRequest` khi gửi. */
export const logisticsFormSchema = z.object({
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, "Đơn vị tính 1–16 ký tự in hoa, số hoặc _"),
  barcode: z.string().trim().max(64, "Mã vạch tối đa 64 ký tự"),
  weightKg: optionalPositive,
  lengthCm: optionalPositive,
  widthCm: optionalPositive,
  heightCm: optionalPositive,
  packageWeightKg: optionalPositive,
  packageLengthCm: optionalPositive,
  packageWidthCm: optionalPositive,
  packageHeightCm: optionalPositive,
  packageCount: optionalCount,
  packSize: optionalCount,
  storageClass: z.enum(STORAGE_CLASSES),
  requiresAdultSignature: z.boolean(),
  shippingRestrictionNote: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự"),
  qcRequired: z.boolean(),
});
export type LogisticsFormValues = z.infer<typeof logisticsFormSchema>;

/** Tối đa ảnh một lần xuất bản (BE `PublishMediaRequest`). */
export const PUBLISH_MEDIA_MAX = 20;
