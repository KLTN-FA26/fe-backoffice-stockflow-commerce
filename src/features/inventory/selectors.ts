import {
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";

// Known backend movement types are localized; a newer code is shown verbatim.
export function movementTypeLabel(type: string): string {
  const known = STOCK_MOVEMENT_TYPES.find((value) => value === type);
  return known ? STOCK_MOVEMENT_LABELS[known] : type;
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
