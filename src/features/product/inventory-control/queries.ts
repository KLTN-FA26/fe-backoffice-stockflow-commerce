import { useQuery } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/api/query-factory";

import { canonicalVariantRouteSchema } from "../variant-schemas";
import { getInventoryControl } from "./api";

const root = createQueryKeys("inventory-control");
export const inventoryControlKeys = {
  all: root.all,
  detail: (productId: string, variantId: string) =>
    [...root.all, "detail", productId.toLowerCase(), variantId.toLowerCase()] as const,
};

export function useInventoryControl(productId: string, variantId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryControlKeys.detail(productId, variantId),
    queryFn: ({ signal }) => getInventoryControl(productId, variantId, signal),
    enabled: enabled && canonicalVariantRouteSchema.safeParse({ productId, variantId }).success,
  });
}
