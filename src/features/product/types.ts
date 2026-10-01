import type { z } from "zod";

import type {
  categorySchema,
  printAreaSchema,
  printTechniqueSchema,
  productAttributeSchema,
  productSchema,
  productStatusSchema,
  productTypeSchema,
  skuSchema,
  skuStatusSchema,
  uomSchema,
} from "./schemas";

export type Category = z.infer<typeof categorySchema>;
export type PrintArea = z.infer<typeof printAreaSchema>;
export type PrintTechnique = z.infer<typeof printTechniqueSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductAttribute = z.infer<typeof productAttributeSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductType = z.infer<typeof productTypeSchema>;
export type Sku = z.infer<typeof skuSchema>;
export type SkuStatus = z.infer<typeof skuStatusSchema>;
export type Uom = z.infer<typeof uomSchema>;
