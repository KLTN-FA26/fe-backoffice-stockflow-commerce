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
  name: z.string().min(1),
  nameEn: z.string().min(1),
  slug: z.string().min(1),
  type: productTypeSchema,
  categoryId: z.string().min(1),
  status: productStatusSchema,
  description: z.string(),
  descriptionEn: z.string(),
  images: z.array(z.string()),
  model3dUrl: z.string().optional(),
  basePrice: z.number().min(0),
  pricingFormula: pricingFormulaSchema.optional(),
  attributes: z.array(productAttributeSchema),
  printAreas: z.array(printAreaSchema).optional(),
  taxClass: z.enum(["standard", "reduced", "exempt"]),
  uom: uomSchema,
  brand: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
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

export const createProductSchema = z
  .object({
    productId: z.string().min(1, "Nhập mã sản phẩm"),
    name: z.string().min(1, "Nhập tên sản phẩm"),
    nameEn: z.string().min(1, "Nhập tên tiếng Anh"),
    type: productTypeSchema,
    categoryId: z.string().min(1, "Chọn danh mục"),
    description: z.string(),
    descriptionEn: z.string(),
    images: z.array(z.string()),
    model3dUrl: z.string().optional(),
    basePrice: z.number().min(0, "Giá không âm"),
    pricingFormula: pricingFormulaSchema.optional(),
    attributes: z
      .array(productAttributeSchema)
      // BR-03 (01-product-creation): thuộc tính biến thể bắt buộc để sinh ít nhất 1 SKU.
      .min(1, "Cần ít nhất 1 thuộc tính biến thể"),
    printAreas: z.array(printAreaSchema).optional(),
    taxClass: z.enum(["standard", "reduced", "exempt"]),
    uom: uomSchema,
    brand: z.string().min(1, "Nhập thương hiệu"),
  })
  // BR-05 (01-product-creation): sản phẩm in ấn phải có print area trước khi Published.
  .superRefine((value, ctx) => {
    if (value.type === "Customizable" && (!value.printAreas || value.printAreas.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["printAreas"],
        message: "Sản phẩm tùy chỉnh cần ít nhất 1 vùng in",
      });
    }
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
export type ProductDto = z.infer<typeof productSchema>;
export type SkuDto = z.infer<typeof skuSchema>;
export type CategoryDto = z.infer<typeof categorySchema>;
export type TransitionProductInput = z.infer<typeof transitionProductSchema>;
export type TransitionSkuInput = z.infer<typeof transitionSkuSchema>;
