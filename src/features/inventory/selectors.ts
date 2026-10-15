import { STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from "@/constants/inventory";

// Known backend movement types are localized; a newer code is shown verbatim.
export function movementTypeLabel(type: string): string {
  const known = STOCK_MOVEMENT_TYPES.find((value) => value === type);
  return known ? STOCK_MOVEMENT_LABELS[known] : type;
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
