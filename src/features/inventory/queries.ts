import { useQuery } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/api/query-factory";

import type { InventoryService } from "./service";

const keys = createQueryKeys("inventory-ui-preview");
export function useInventoryPreview(service: InventoryService) {
  return useQuery({
    queryKey: keys.list({ source: service.cacheKey }),
    queryFn: ({ signal }) => service.loadPreview(signal),
    retry: false,
  });
}
