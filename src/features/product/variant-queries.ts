import { useQuery } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/api/query-factory";

import { getCanonicalVariant, listCanonicalVariants } from "./variant-api";
import { canonicalUuidSchema, canonicalVariantRouteSchema } from "./variant-schemas";

const root = createQueryKeys("canonical-product-variants");
export const canonicalVariantKeys = {
  all: root.all,
  list: (productId: string, page: number, size: number) =>
    root.list({ productId: productId.toLowerCase(), page, size }),
  detail: (productId: string, variantId: string) =>
    [...root.all, "detail", productId.toLowerCase(), variantId.toLowerCase()] as const,
};

export function useCanonicalVariants(
  productId: string,
  page: number,
  size: number,
  enabled = true,
) {
  return useQuery({
    queryKey: canonicalVariantKeys.list(productId, page, size),
    queryFn: ({ signal }) => listCanonicalVariants(productId, { page, size }, signal),
    enabled: enabled && canonicalUuidSchema.safeParse(productId).success,
  });
}

export function useCanonicalVariant(productId: string, variantId: string, enabled = true) {
  return useQuery({
    queryKey: canonicalVariantKeys.detail(productId, variantId),
    queryFn: ({ signal }) => getCanonicalVariant(productId, variantId, signal),
    enabled: enabled && canonicalVariantRouteSchema.safeParse({ productId, variantId }).success,
  });
}
