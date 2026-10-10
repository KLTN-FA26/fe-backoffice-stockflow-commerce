import { api } from "@/lib/api/client";

import { CANONICAL_VARIANT_TEXT } from "./variant-constants";
import {
  canonicalVariantDtoSchema,
  canonicalVariantPageSchema,
  canonicalVariantRouteSchema,
  canonicalUuidSchema,
  mapCanonicalVariant,
} from "./variant-schemas";

const variantsPath = (productId: string) => `/products/${encodeURIComponent(productId)}/variants`;

export class CanonicalVariantIdentityError extends Error {
  constructor() {
    super(CANONICAL_VARIANT_TEXT.mismatch);
  }
}

export async function listCanonicalVariants(
  productId: string,
  params: { page: number; size: number },
  signal?: AbortSignal,
) {
  const id = canonicalUuidSchema.parse(productId);
  const { data } = await api.get<unknown>(variantsPath(id), { params, signal });
  const page = canonicalVariantPageSchema.parse(data);
  if (page.items.some((row) => row.productId !== id)) throw new CanonicalVariantIdentityError();
  return { ...page, items: page.items.map(mapCanonicalVariant) };
}

export async function getCanonicalVariant(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
) {
  const ids = canonicalVariantRouteSchema.parse({ productId, variantId });
  const { data } = await api.get<unknown>(
    `${variantsPath(ids.productId)}/${encodeURIComponent(ids.variantId)}`,
    { signal },
  );
  const dto = canonicalVariantDtoSchema.parse(data);
  if (dto.productId !== ids.productId || dto.variantId !== ids.variantId)
    throw new CanonicalVariantIdentityError();
  return mapCanonicalVariant(dto);
}
