/**
 * Product — zod schemas + BR traceability.
 *
 * Nguồn BR: docs/warehouse/01-product-creation/README.md §6.
 */

import { z } from "zod";

import { PRODUCT_STATUSES } from "@/constants";

import { axisInputSchema } from "./axes-schemas";

export const productStatusValues = PRODUCT_STATUSES;

export const productTypeValues = ["Standard", "Customizable"] as const;
export const uomValues = ["pcs", "box", "kg", "m", "ream", "set"] as const;
export const printTechniqueValues = ["DTG", "DTF", "Screen", "Embroidery", "Sublimation"] as const;

export const productStatusSchema = z.enum(productStatusValues);
export const productTypeSchema = z.enum(productTypeValues);
export const uomSchema = z.enum(uomValues);
export const printTechniqueSchema = z.enum(printTechniqueValues);

export const bilingualLabelSchema = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
});

export const productAttributeSchema = z.object({
  attributeId: z.string(),
  name: bilingualLabelSchema,
  values: z.array(z.string().min(1)).min(1),
  swatch: z.record(z.string(), z.string()).optional(),
});

export const pricingFormulaSchema = z.object({
  basePrintPrice: z.number().min(0),
  perSquareCmPrice: z.number().min(0),
  techniqueMultiplier: z.record(printTechniqueSchema, z.number().positive()),
  colorCountSurcharge: z.number().min(0),
});

export const printAreaSchema = z.object({
  printAreaId: z.string(),
  productId: z.string(),
  name: bilingualLabelSchema,
  position: z.enum(["front", "back", "left-sleeve", "right-sleeve", "full"]),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  minDpi: z.number().int().positive(),
  bleedMm: z.number().min(0),
  safeMarginMm: z.number().min(0),
  allowedTechniques: z.array(printTechniqueSchema).min(1),
});

export const productSchema = z.object({
  productId: z.string(),
  code: z.string().optional(),
  name: z.string().min(1),
  nameEn: z.string().min(1),
  /** Legacy/mock catalog fields. ProductResponse does not provide these in real mode. */
  slug: z.string().min(1).optional(),
  type: productTypeSchema,
  categoryId: z.string().min(1).nullable(),
  status: productStatusSchema,
  /** BE `ProductResponse.version` — gửi lại khi sửa / ngừng kinh doanh (409 OPTIMISTIC_LOCK nếu đã đổi). */
  version: z.number().int(),
  description: z.string(),
  descriptionEn: z.string(),
  images: z.array(z.string()),
  model3dUrl: z.string().optional(),
  basePrice: z.number().min(0).optional(),
  pricingFormula: pricingFormulaSchema.optional(),
  attributes: z.array(productAttributeSchema).optional(),
  printAreas: z.array(printAreaSchema).optional(),
  taxClass: z.enum(["standard", "reduced", "exempt"]),
  uom: uomSchema.optional(),
  /** Tên thương hiệu để hiển thị ("" nếu chưa gán). BE PR #71: `brandName`. */
  brand: z.string(),
  /** BE PR #71: thương hiệu là bản ghi `product.brands`, gán theo id. */
  brandId: z.string().nullable().optional(),
  shortDescription: z.string().optional(),
  rejectionReason: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string(),
  submittedBy: z.string().optional(),
  submittedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  suspendedAt: z.string().optional(),
  suspendReason: z.string().optional(),
  discontinuedAt: z.string().optional(),
  discontinueReason: z.string().optional(),
  weightKg: z.number().positive().nullable().optional(),
  lengthCm: z.number().positive().nullable().optional(),
  widthCm: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
});

export const categorySchema = z.object({
  categoryId: z.string(),
  name: bilingualLabelSchema,
  parentId: z.string().nullable(),
  /** `depth` + 1 của BE — cây tối đa 11 cấp (CHECK `ck_categories_depth` 0–10, TAXONOMY_LIMITS). */
  level: z.number().int().min(1),
  slug: z.string(),
  /** BE `CategoryResponse.active` — không có thì coi như đang dùng. */
  active: z.boolean().optional(),
});

/** BE PR #71 `CategoryResponse` — một nút của cây danh mục (`depth` 0 là gốc). */
export const beCategorySchema = z.object({
  categoryId: z.string(),
  parentId: z.string().nullish(),
  code: z.string(),
  name: z.string(),
  slug: z.string(),
  path: z.string(),
  depth: z.number().int().min(0),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

/** BE PR #71 `BrandResponse`. */
export const beBrandSchema = z.object({
  brandId: z.string(),
  code: z.string(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullish(),
  active: z.boolean(),
});

/** BE PR #71: STANDARD (bán nguyên mẫu) | CUSTOMIZABLE (in theo thiết kế của khách). */
export const productKindValues = ["STANDARD", "CUSTOMIZABLE"] as const;

/** BE `ProductStatus` (product/api/ProductStatus.java). INACTIVE = tạm ngưng (kltn-docs 01 §5.1). */
export const beProductStatusValues = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "INACTIVE",
  "DISCONTINUED",
] as const;

/**
 * Trạng thái BE chưa biết (BE thêm sau) → "UNKNOWN" thay vì làm hỏng cả danh sách sản phẩm —
 * cùng cách với `deliveryStatusSchema` của PO.
 */
export const beProductStatusSchema = z.enum([...beProductStatusValues, "UNKNOWN"]).catch("UNKNOWN");

/**
 * BE PR #71 `ProductResponse`. Ảnh nằm ở biến thể (`/variants/{id}/media`), kích thước / khối
 * lượng nằm ở hồ sơ hàng tồn của SKU (`/inventory/items/{id}`, BE PR #119) — không còn trên dòng
 * sản phẩm.
 */
export const productMasterDtoSchema = z.object({
  // Id do BE cấp; seed demo có id không đúng biến thể RFC 4122 nên không dùng `.uuid()` (zod v4
  // kiểm biến thể) — FE không được chặt hơn BE với id của chính BE.
  productId: z.string().min(1),
  code: z.string(),
  name: z.string(),
  nameEn: z.string().nullish(),
  slug: z.string().nullish(),
  brandId: z.string().nullish(),
  brandName: z.string().nullish(),
  categoryId: z.string().nullish(),
  shortDescription: z.string().nullish(),
  description: z.string().nullish(),
  descriptionEn: z.string().nullish(),
  taxClass: z.enum(["STANDARD", "REDUCED", "EXEMPT"]),
  kind: z.enum(productKindValues),
  status: beProductStatusSchema,
  /** BE `long version` — luôn có; bản ghi mới tạo là 0. */
  version: z.number().int().min(0),
  createdAt: z.string(),
  createdBy: z.string().nullish(),
  submittedBy: z.string().nullish(),
  submittedAt: z.string().nullish(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  rejectionReason: z.string().nullish(),
  /** Chỉ có khi INACTIVE (tạm ngưng) / DISCONTINUED — kèm lý do (BE `ck_products_inactive` / `_discontinued`). */
  suspendedAt: z.string().nullish(),
  suspendReason: z.string().nullish(),
  discontinuedAt: z.string().nullish(),
  discontinueReason: z.string().nullish(),
});

/** BE `CreateProductRequest.code`: 1–50 ký tự chữ/số/'_'/'-', bắt đầu bằng chữ hoặc số. */
export const PRODUCT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;

/** BE PR #71 `CreateProductRequest`. */
export const createProductSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã sản phẩm")
    .max(50, "Mã sản phẩm tối đa 50 ký tự")
    .regex(PRODUCT_CODE_PATTERN, "Mã chỉ gồm chữ, số, '_' và '-', bắt đầu bằng chữ hoặc số"),
  name: z.string().trim().min(1, "Nhập tên sản phẩm").max(255, "Tên tối đa 255 ký tự"),
  nameEn: z.string().trim().min(1, "Nhập tên tiếng Anh").max(300, "Tên tiếng Anh tối đa 300 ký tự"),
  // docs 01 §3 requires category at product creation. The backend accepts null for a draft,
  // but the admin workflow deliberately enforces the stricter business source of truth.
  categoryId: z.string().trim().min(1, "Chọn danh mục"),
  // docs 01 §3: thương hiệu là thông tin định danh — FE bắt chọn dù BE cho phép null ở Draft.
  brandId: z.string().trim().min(1, "Chọn thương hiệu"),
  shortDescription: z.string().optional(),
  description: z.string(),
  descriptionEn: z.string(),
  taxClass: z.enum(["STANDARD", "REDUCED", "EXEMPT"]),
  kind: z.enum(productKindValues),
  /**
   * BE PR #116: có `axes` thì BE tạo luôn MỌI tổ hợp giá trị đang dùng (SKU `MÃ-GIÁ_TRỊ-…`, tổ hợp
   * đầu tiên là biến thể mặc định) trong cùng giao dịch — bị từ chối (SKU trùng, quá 100 tổ hợp…) thì
   * không để lại sản phẩm nào. Không có `axes`: một biến thể mặc định có SKU = mã sản phẩm.
   */
  axes: z.array(axisInputSchema).optional(),
});

/** BE `UpdateProductRequest`: như tạo, không có `code`, thêm `version` (@NotNull) của lần đọc trước. */
export const updateProductSchema = createProductSchema
  .omit({ code: true, axes: true })
  .extend({ version: z.number().int().min(0) });

/** Độ dài tối đa của lý do ngừng kinh doanh — BE `DiscontinueProductRequest.reason` @Size(max = 500). */
export const DISCONTINUE_REASON_MAX = 500;

/** BE `DiscontinueProductRequest`: `reason` bắt buộc (kltn-docs 01 §5.2), `version` của lần đọc trước. */
export const discontinueProductSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Lý do ngừng kinh doanh là bắt buộc")
    .max(DISCONTINUE_REASON_MAX, `Lý do tối đa ${DISCONTINUE_REASON_MAX} ký tự`),
  version: z.number().int().min(0),
});

export const productDraftFormSchema = z.object({
  productCode: createProductSchema.shape.code,
  name: createProductSchema.shape.name,
  nameEn: createProductSchema.shape.nameEn,
  categoryId: createProductSchema.shape.categoryId,
  brandId: createProductSchema.shape.brandId,
  shortDescription: z.string(),
  description: z.string(),
  descriptionEn: z.string(),
  taxClass: createProductSchema.shape.taxClass,
  customizable: z.boolean(),
});

export const transitionProductSchema = z
  .object({
    id: z.string(),
    // Ngừng kinh doanh có body riêng (`discontinueProductSchema`) nên không đi qua đây.
    action: z.enum(["submit", "approve", "reject"]),
    reason: z.string().optional(),
  })
  .refine((value) => value.action !== "reject" || Boolean(value.reason?.trim()), {
    path: ["reason"],
    message: "Lý do từ chối là bắt buộc",
  });

export type ProductStatusValue = z.infer<typeof productStatusSchema>;
export type ProductTypeValue = z.infer<typeof productTypeSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type DiscontinueProductBody = z.infer<typeof discontinueProductSchema>;
export type ProductMasterDto = z.infer<typeof productMasterDtoSchema>;
export type ProductDraftFormValues = z.infer<typeof productDraftFormSchema>;
export type ProductDto = z.infer<typeof productSchema>;
export type CategoryDto = z.infer<typeof categorySchema>;
export type BeCategoryDto = z.infer<typeof beCategorySchema>;
export type BrandDto = z.infer<typeof beBrandSchema>;
export type TransitionProductInput = z.infer<typeof transitionProductSchema>;
