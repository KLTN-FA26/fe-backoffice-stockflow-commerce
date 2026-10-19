import { MOVE_LIMITS } from "@/constants/move";

import type { StockRow, WarehouseLayout } from "./types";

// BE `LocationId`: trim + upper case.
export function normalizeLocation(code: string): string {
  return code.trim().toUpperCase();
}

/** Warehouse prefix = the segment before the first hyphen (BE `LocationId.warehouseCode()`). */
export function warehouseOf(code: string): string {
  const normalized = normalizeLocation(code);
  const dash = normalized.indexOf(MOVE_LIMITS.warehouseSeparator);
  return dash > 0 ? normalized.slice(0, dash) : normalized;
}

export function sameLocation(from: string, to: string): boolean {
  const a = normalizeLocation(from);
  return a !== "" && a === normalizeLocation(to);
}

// Docs 11 BR-01: both ends must be in the same warehouse. Only judged once both are filled in.
export function sameWarehouse(from: string, to: string): boolean {
  if (normalizeLocation(from) === "" || normalizeLocation(to) === "") return true;
  return warehouseOf(from) === warehouseOf(to);
}

/** Units that may leave a stock row: onHand − reserved, whatever the status (BE `StockItem.movable`). */
export function movableQuantity(row: Pick<StockRow, "onHand" | "reserved">): number {
  return Math.max(0, row.onHand - row.reserved);
}

/** The stock row a typed source (location + lot) points at, if the SKU's rows are known. */
export function findSourceRow(
  rows: readonly StockRow[] | undefined,
  fromLocation: string,
  lotNumber: string | undefined,
): StockRow | undefined {
  const location = normalizeLocation(fromLocation);
  const lot = lotNumber?.trim() ?? "";
  return rows?.find((row) => row.locationCode === location && (row.lotNumber ?? "") === lot);
}

/** Usable bins and storage areas of a layout, sorted — what a move may be sent to (BR-03). */
export function destinationCodes(layout: WarehouseLayout | undefined): string[] {
  if (!layout) return [];
  const places = [
    ...layout.shelves.flatMap((shelf) => shelf.levels.flatMap((level) => level.bins)),
    ...layout.areas,
  ];
  const codes = places
    .filter((place) => place.usable === true && place.locationCode)
    .map((place) => normalizeLocation(place.locationCode ?? ""));
  return [...new Set(codes)].sort();
}
