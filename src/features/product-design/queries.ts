import { useQuery } from "@tanstack/react-query";

import { getPrintConfig } from "./api";

/**
 * Query keys of print configurations, one entry per variant. No key of `features/product` shows whether a variant
 * has a 3D model (its variant and product DTOs do not carry it), so no shared root is needed.
 */
export const printConfigKeys = {
  all: ["print-configs"] as const,
  variant: (productId: string, variantId: string) =>
    [...printConfigKeys.all, productId, variantId] as const,
};

/** The variant's print configuration; `null` data when it has none (not an error). */
export function usePrintConfig(productId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: printConfigKeys.variant(productId ?? "", variantId ?? ""),
    queryFn: ({ signal }) => getPrintConfig(productId ?? "", variantId ?? "", signal),
    enabled: Boolean(productId) && Boolean(variantId),
  });
}
