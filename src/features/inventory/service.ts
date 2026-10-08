import type {
  AtpLookupInput,
  AtpLookupResult,
  InventoryPreview,
  ReservationRow,
  StockItemRow,
} from "./types";

/** UI data-source port. No HTTP endpoint, query parameters, or pagination contract. */
export interface InventoryService {
  /** Adapter namespace: keep future real data separate from demo cache. */
  readonly cacheKey: string;
  loadPreview(signal?: AbortSignal): Promise<InventoryPreview>;
  loadStockItems(sku: string, warehouseCode: string, signal?: AbortSignal): Promise<StockItemRow[]>;
  lookupAtp(input: AtpLookupInput, signal?: AbortSignal): Promise<AtpLookupResult | null>;
  loadReservations(signal?: AbortSignal): Promise<ReservationRow[]>;
}

// TODO(contract): real adapter maps DTOs to view-models after BE confirmation.
// TODO(contract): map BE's unknown-pair response to null without conflating it with ATP zero.
// TODO(business): subcontract-blank identification and ATP exclusion belong upstream.
// TODO(business): low-stock threshold/metric and near-expiry window remain undecided.
// TODO(contract): real adapter must supply display highlights from confirmed BE signals/rules.
// TODO(contract): reservation expiry semantics; status versus condition mapping.
// TODO(contract): GET reservations endpoint, list scope and response shape are not confirmed.
// TODO(contract): warehouse authorization, VIEW_PAGE/READ gating and list/search pagination.
