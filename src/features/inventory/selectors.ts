import {
  INVENTORY_LABELS,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_ALERT_KIND_LABELS,
  STOCK_ALERT_KINDS,
  STOCK_ALERT_STATUS_LABELS,
  STOCK_ALERT_STATUSES,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";

import type { WarehouseOption } from "@/lib/references/warehouse-options";

// Known backend movement types are localized; a newer code is shown verbatim.
export function movementTypeLabel(type: string): string {
  const known = STOCK_MOVEMENT_TYPES.find((value) => value === type);
  return known ? STOCK_MOVEMENT_LABELS[known] : type;
}

// Ledger stock status codes are shown verbatim: `AVAILABLE → EXPIRED` when the row changes
// status (e.g. BE expiry sweep STATUS_CHANGE), the one known side otherwise.
export function movementStatusLabel(status?: string | null, toStatus?: string | null): string {
  if (status && toStatus && status !== toStatus) {
    return `${status} ${INVENTORY_LABELS.statusTransition} ${toStatus}`;
  }
  return status || toStatus || INVENTORY_LABELS.missing;
}

// Known adjustment reasons are localized; a newer backend code is shown verbatim.
export function adjustmentReasonLabel(reason: string): string {
  const known = STOCK_ADJUSTMENT_REASONS.find((value) => value === reason);
  return known ? STOCK_ADJUSTMENT_REASON_LABELS[known] : reason;
}

// Adjustment deltas carry their direction: +5 writes stock up, -5 writes it down.
export function formatSignedQuantity(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

// Use backend page metadata, never totals calculated from the current page.
export function inventoryPageRange(page: {
  items: readonly unknown[];
  page: number;
  size: number;
  totalElements: number;
}) {
  if (!page.items.length) return { first: 0, last: 0, total: page.totalElements };
  const first = page.page * page.size + 1;
  return {
    first,
    last: Math.min(first + page.items.length - 1, page.totalElements),
    total: page.totalElements,
  };
}

/**
 * The directory entry of a stock-level warehouse code (the backend location prefix). No match is
 * `null`: the caller must not fall back to another warehouse or derive an id from the code.
 */
export function selectWarehouseByCode(
  directory: readonly WarehouseOption[],
  code: string,
): WarehouseOption | null {
  const wanted = code.trim().toUpperCase();
  return directory.find((warehouse) => warehouse.code.trim().toUpperCase() === wanted) ?? null;
}

// Known alert kinds/statuses are localized; a newer backend code is shown verbatim.
export function alertKindLabel(kind: string): string {
  const known = STOCK_ALERT_KINDS.find((value) => value === kind);
  return known ? STOCK_ALERT_KIND_LABELS[known] : kind;
}

export function alertStatusLabel(status: string): string {
  const known = STOCK_ALERT_STATUSES.find((value) => value === status);
  return known ? STOCK_ALERT_STATUS_LABELS[known] : status;
}

// A warehouse id from a link: the backend sends a UUID; the mock directory uses short codes. Only
// letters, digits and hyphens ever reach the request — the backend still validates and scopes it.
const LINK_WAREHOUSE_ID = /^[A-Za-z0-9-]{1,64}$/;

type AlertKind = (typeof STOCK_ALERT_KINDS)[number];

/**
 * Filters of `/admin/inventory/alerts?kind=…&warehouseId=…` (BE InventoryAlertMessages, the link of
 * an INVENTORY_ALERT notification). An unknown kind or malformed id is dropped, never sent to the
 * backend, and reported so the page can say the link was not fully understood.
 */
export function parseAlertLinkFilters(raw: { kind: string | null; warehouseId: string | null }): {
  kind: AlertKind | null;
  warehouseId: string | null;
  rejected: boolean;
} {
  const kind = STOCK_ALERT_KINDS.find((value) => value === raw.kind) ?? null;
  const warehouseId =
    raw.warehouseId !== null && LINK_WAREHOUSE_ID.test(raw.warehouseId) ? raw.warehouseId : null;
  const rejected =
    (raw.kind !== null && kind === null) || (raw.warehouseId !== null && warehouseId === null);
  return { kind, warehouseId, rejected };
}
