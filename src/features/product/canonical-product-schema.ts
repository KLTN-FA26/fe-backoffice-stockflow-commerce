import { z } from "zod";

import { productMasterDtoSchema } from "./schemas";
import { canonicalUuidSchema } from "./variant-schemas";

// Read-only ProductResponse subset from BE 8ea4ca1. Nullable fields are omitted on the wire.
// This does not change the legacy Product create/update contract.
export const canonicalProductReadSchema = productMasterDtoSchema
  .pick({
    code: true,
    name: true,
    taxClass: true,
    status: true,
    createdAt: true,
  })
  .extend({
    productId: canonicalUuidSchema,
    kind: z.enum(["STANDARD", "CUSTOMIZABLE"]),
    nameEn: z.string().optional(),
    brandName: z.string().optional(),
    categoryId: canonicalUuidSchema.optional(),
    description: z.string().optional(),
    descriptionEn: z.string().optional(),
    createdBy: z.string().optional(),
    submittedBy: canonicalUuidSchema.optional(),
    submittedAt: z.iso.datetime().optional(),
    approvedBy: canonicalUuidSchema.optional(),
    approvedAt: z.iso.datetime().optional(),
    rejectionReason: z.string().optional(),
  });
