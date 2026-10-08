import type { InventoryPreview, StockItemRow } from "./types";

/** UI data-source port. No HTTP endpoint, query parameters, or pagination contract. */
export interface InventoryService {
  /** Adapter namespace: keep future real data separate from demo cache. */
  readonly cacheKey: string;
  loadPreview(signal?: AbortSignal): Promise<InventoryPreview>;
  loadStockItems(sku: string, warehouseCode: string, signal?: AbortSignal): Promise<StockItemRow[]>;
}

// TODO(contract): real adapter maps DTOs to view-models after BE confirmation.
// TODO(business): subcontract-blank identification and ATP exclusion belong upstream.
// TODO(business): low-stock threshold/metric and near-expiry window remain undecided.
// TODO(contract): reservation expiry semantics; status versus condition mapping.
// TODO(contract): warehouse authorization, VIEW_PAGE/READ gating and list/search pagination.
