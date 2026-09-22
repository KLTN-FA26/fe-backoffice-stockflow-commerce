/**
 * Supplier — inferred types from zod schemas.
 *
 * Source: docs/warehouse/02-purchase-order (supplier master data phục vụ PO).
 * Status is canonical from this module; PO feature reuses it.
 */

import type { z } from "zod";

import type {
  supplierStatusSchema,
  supplierDtoSchema,
  supplierCreateInputSchema,
  supplierUpdateInputSchema,
  supplierToggleStatusSchema,
} from "./schemas";

export type SupplierStatus = z.infer<typeof supplierStatusSchema>;
export type SupplierDto = z.infer<typeof supplierDtoSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateInputSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateInputSchema>;
export type SupplierToggleStatusInput = z.infer<typeof supplierToggleStatusSchema>;

/** Re-export as "Supplier" alias for backward compatibility with PO feature import. */
export type { SupplierDto as Supplier };
