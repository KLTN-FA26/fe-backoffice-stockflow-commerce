/**
 * Supplier — kiểu suy ra từ zod schemas (không khai báo tay).
 */

import type { z } from "zod";

import type { supplierItemFormSchema } from "./item-schemas";

import type {
  supplierApiDtoSchema,
  supplierChannelSchema,
  supplierDtoSchema,
  supplierFormSchema,
  supplierStatusSchema,
  supplierUpdateInputSchema,
} from "./schemas";

export type SupplierStatus = z.infer<typeof supplierStatusSchema>;
export type SupplierChannel = z.infer<typeof supplierChannelSchema>;
export type SupplierApiDto = z.infer<typeof supplierApiDtoSchema>;
export type SupplierDto = z.infer<typeof supplierDtoSchema>;
export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateInputSchema>;

// Danh mục hàng NCC — hợp đồng DTO nằm ở lib/references (dùng chung với purchase-order)
export type { SupplierItemRef as SupplierItem } from "@/lib/references/supplier-items";
export type SupplierItemFormValues = z.infer<ReturnType<typeof supplierItemFormSchema>>;
