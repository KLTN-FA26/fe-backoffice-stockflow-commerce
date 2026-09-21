/**
 * Product — zod schemas + BR traceability.
 *
 * Nguồn BR: docs/warehouse/01-product-creation/README.md §6.
 */

import { z } from "zod";

import { PRODUCT_STATUSES, SKU_STATUSES } from "@/constants";

export const productStatusValues = PRODUCT_STATUSES;

export const skuStatusValues = SKU_STATUSES;
export const productTypeValues = ["Standard", "Customizable"] as const;
export const uomValues = ["pcs", "box", "kg", "m", "ream", "set"] as const;
export const printTechniqueValues = ["DTG", "DTF", "Screen", "Embroidery", "Sublimation"] as const;

export const productStatusSchema = z.enum(productStatusValues);
export const skuStatusSchema = z.enum(skuStatusValues);
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
  slug: z.string().min(1),
  type: productTypeSchema,
  categoryId: z.string().min(1).nullable(),
  status: productStatusSchema,
  description: z.string(),
  descriptionEn: z.string(),
  images: z.array(z.string()),
  model3dUrl: z.string().optional(),
  // Legacy/mock-only product field. Real ProductResponse does not provide it.
  basePrice: z.number().min(0).optional().nullable(),
  pricingFormula: pricingFormulaSchema.optional(),
  // Undefined means the backend did not provide product attributes; [] means genuinely empty.
  attributes: z.array(productAttributeSchema).optional(),
  printAreas: z.array(printAreaSchema).optional(),
  taxClass: z.enum(["standard", "reduced", "exempt"]),
  // Legacy/mock-only product field. Real ProductResponse does not provide it.
  uom: uomSchema.optional().nullable(),
  brand: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  weightKg: z.number().positive().nullable().optional(),
  lengthCm: z.number().positive().nullable().optional(),
  widthCm: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
});

export const skuSchema = z.object({
  skuId: z.string(),
  productId: z.string(),
  barcode: z.string(),
  variantLabel: z.string(),
  attributes: z.record(z.string(), z.string()),
  status: skuStatusSchema,
  uom: uomSchema,
  price: z.number().min(0),
  cost: z.number().min(0),
  weightKg: z.number().positive(),
  lotTracking: z.boolean(),
  serialTracking: z.boolean(),
  expiryTracking: z.boolean(),
  stockOnHand: z.number().int().min(0),
  stockReserved: z.number().int().min(0),
  stockAvailable: z.number().int(),
  reorderPoint: z.number().int().min(0),
  imageUrl: z.string().optional(),
});

export const categorySchema = z.object({
  categoryId: z.string(),
  name: bilingualLabelSchema,
  parentId: z.string().nullable(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slug: z.string(),
});

const optionalPositiveNumber = z.number().positive("Giá trị phải lớn hơn 0").nullable();

export const productMasterDtoSchema = z.object({
  productId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  nameEn: z.string(),
  categoryId: z.string().uuid().nullish(),
  description: z.string().nullish(),
  descriptionEn: z.string().nullish(),
  brand: z.string(),
  taxClass: z.enum(["STANDARD", "REDUCED", "EXEMPT"]),
  customizable: z.boolean(),
  images: z.array(z.string()),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "DISCONTINUED"]),
  createdAt: z.string(),
  createdBy: z.string().nullish(),
  submittedBy: z.string().uuid().nullish(),
  submittedAt: z.string().nullish(),
  approvedBy: z.string().uuid().nullish(),
  approvedAt: z.string().nullish(),
  rejectionReason: z.string().nullish(),
  weightKg: optionalPositiveNumber.optional(),
  lengthCm: optionalPositiveNumber.optional(),
  widthCm: optionalPositiveNumber.optional(),
  heightCm: optionalPositiveNumber.optional(),
});

export const createProductSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Nhập mã sản phẩm")
    .max(64, "Mã sản phẩm tối đa 64 ký tự")
    .regex(/^[A-Za-z0-9-]+$/, "Mã chỉ gồm chữ, số và dấu gạch ngang"),
  name: z.string().trim().min(1, "Nhập tên sản phẩm"),
  nameEn: z.string().trim().min(1, "Nhập tên tiếng Anh"),
  // docs 01 §3 requires category at product creation. The backend accepts null for a draft,
  // but the admin workflow deliberately enforces the stricter business source of truth.
  categoryId: z.string().trim().min(1, "Chọn danh mục"),
  description: z.string(),
  descriptionEn: z.string(),
  brand: z.string().trim().min(1, "Nhập thương hiệu"),
  taxClass: z.enum(["STANDARD", "REDUCED", "EXEMPT"]),
  customizable: z.boolean(),
  images: z.array(z.string()),
  // BR-03 (docs 01 §6): logistics fields are required before Receipt/Putaway, not while saving Draft.
  weightKg: optionalPositiveNumber,
  lengthCm: optionalPositiveNumber,
  widthCm: optionalPositiveNumber,
  heightCm: optionalPositiveNumber,
});

export const updateProductSchema = createProductSchema.omit({ code: true });

const optionalPositiveText = z
  .string()
  .refine((value) => value.trim() === "" || Number(value) > 0, "Giá trị phải lớn hơn 0");

export const productDraftFormSchema = z.object({
  productCode: createProductSchema.shape.code,
  name: createProductSchema.shape.name,
  nameEn: createProductSchema.shape.nameEn,
  categoryId: createProductSchema.shape.categoryId,
  description: z.string(),
  descriptionEn: z.string(),
  brand: createProductSchema.shape.brand,
  taxClass: createProductSchema.shape.taxClass,
  customizable: z.boolean(),
  imageUrls: z.string(),
  weightKg: optionalPositiveText,
  lengthCm: optionalPositiveText,
  widthCm: optionalPositiveText,
  heightCm: optionalPositiveText,
});

export const transitionProductSchema = z.object({
  id: z.string(),
  targetStatus: productStatusSchema,
  reason: z.string().optional(),
});

export const transitionSkuSchema = z.object({
  id: z.string(),
  targetStatus: skuStatusSchema,
  reason: z.string().optional(),
});

export type ProductStatusValue = z.infer<typeof productStatusSchema>;
export type SkuStatusValue = z.infer<typeof skuStatusSchema>;
export type ProductTypeValue = z.infer<typeof productTypeSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductMasterDto = z.infer<typeof productMasterDtoSchema>;
export type ProductDraftFormValues = z.infer<typeof productDraftFormSchema>;
export type ProductDto = z.infer<typeof productSchema>;
export type SkuDto = z.infer<typeof skuSchema>;
export type CategoryDto = z.infer<typeof categorySchema>;
export type TransitionProductInput = z.infer<typeof transitionProductSchema>;
export type TransitionSkuInput = z.infer<typeof transitionSkuSchema>;
