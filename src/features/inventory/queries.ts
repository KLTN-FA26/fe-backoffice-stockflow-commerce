import { useQuery } from "@tanstack/react-query";

import { createQueryKeys } from "@/lib/api/query-factory";

import type { InventoryService } from "./service";
import type { AtpLookupInput } from "./types";

const keys = createQueryKeys("inventory-ui-preview");
const stockItemKeys = createQueryKeys("inventory-ui-stock-items");
const atpKeys = createQueryKeys("inventory-ui-atp");
const reservationKeys = createQueryKeys("inventory-ui-reservations");
export function useInventoryPreview(service: InventoryService) {
  return useQuery({
    queryKey: keys.list({ source: service.cacheKey }),
    queryFn: ({ signal }) => service.loadPreview(signal),
    retry: false,
  });
}

export function useInventoryStockItems(
  service: InventoryService,
  sku: string | undefined,
  warehouseCode: string | undefined,
) {
  return useQuery({
    queryKey: stockItemKeys.list({ source: service.cacheKey, sku, warehouseCode }),
    queryFn: ({ signal }) => service.loadStockItems(sku ?? "", warehouseCode ?? "", signal),
    enabled: Boolean(sku && warehouseCode),
    retry: false,
  });
}

export function useInventoryAtp(service: InventoryService, input: AtpLookupInput | null) {
  return useQuery({
    queryKey: atpKeys.list({ source: service.cacheKey, input }),
    queryFn: ({ signal }) => (input ? service.lookupAtp(input, signal) : Promise.resolve(null)),
    enabled: input !== null,
    retry: false,
  });
}

export function useInventoryReservations(service: InventoryService) {
  return useQuery({
    queryKey: reservationKeys.list({ source: service.cacheKey }),
    queryFn: ({ signal }) => service.loadReservations(signal),
    retry: false,
  });
}
