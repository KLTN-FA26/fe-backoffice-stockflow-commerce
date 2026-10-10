import { z } from "zod";

// BE 8ea4ca1: VariantResponse, VariantJpaEntity and Jackson NON_NULL configuration.
// Java UUID accepts GUID syntax without restricting the UUID version nibble.
export const canonicalUuidSchema = z.guid().transform((id) => id.toLowerCase());
export const canonicalVariantRouteSchema = z.object({
  productId: canonicalUuidSchema,
  variantId: canonicalUuidSchema,
});
export const canonicalVariantDtoSchema = canonicalVariantRouteSchema.extend({
  sku: z.string(),
  name: z.string(),
  status: z.enum(["DRAFT", "ACTIVE", "BLOCKED", "OBSOLETE"]),
  defaultVariant: z.boolean(),
  attributeSignature: z.string(),
  position: z.number().int(),
  obsoletedAt: z.iso.datetime().optional(),
  version: z.number().int(),
});
export const canonicalVariantIdentitySchema = canonicalVariantDtoSchema.pick({
  productId: true,
  variantId: true,
  sku: true,
});
export const canonicalVariantPageSchema = z.object({
  items: z.array(canonicalVariantDtoSchema),
  page: z.number().int(),
  size: z.number().int(),
  totalElements: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

export type CanonicalVariantIdentity = z.infer<typeof canonicalVariantIdentitySchema>;
export type CanonicalVariantDto = z.infer<typeof canonicalVariantDtoSchema>;

/** Called only after response parsing at the API boundary; not a legacy Sku adapter. */
export function mapCanonicalVariant(dto: CanonicalVariantDto) {
  const { productId, variantId, sku, ...presentation } = dto;
  const identity: CanonicalVariantIdentity = { productId, variantId, sku };
  return { identity, ...presentation };
}
export type CanonicalVariant = ReturnType<typeof mapCanonicalVariant>;
