/**
 * Reference lookups — cached via React Query master data.
 *
 * Replaces scattered `.find()` calls in page components.
 * Until React Query is wired up, falls back to mock-data directly.
 */

import { warehouses, categories, type Category } from "@/lib/mock-data";

/* ── Build lookup maps (static for now, will use React Query later) ─── */

const warehouseMap = new Map(warehouses.map((w) => [w.warehouseId as string, w]));

const categoryMap = new Map<string, Category>(categories.map((c) => [c.categoryId, c]));

/* ── Lookup functions ────────────────────────────────────────────────── */

export function getWarehouseName(id: string): string {
  return warehouseMap.get(id)?.name ?? "—";
}

export function getCategoryName(id: string, lang: "vi" | "en" = "vi"): string {
  const cat = categoryMap.get(id);
  if (!cat) return "—";
  return cat.name[lang];
}

export function getCategoryNameVi(id: string): string {
  return getCategoryName(id, "vi");
}
