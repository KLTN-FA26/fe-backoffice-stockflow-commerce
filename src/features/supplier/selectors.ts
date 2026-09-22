/**
 * Supplier — pure selectors for stats & derived states.
 */

import { getSupplierName } from "@/lib/references";

import type { SupplierDto } from "./types";

/* ── Stats ───────────────────────────────────────────────────────────── */

export interface SupplierStats {
  total: number;
  active: number;
  inactive: number;
  activeRate: number;
}

export function computeSupplierStats(list: SupplierDto[]): SupplierStats {
  const total = list.length;
  const active = list.filter((s) => s.status === "Active").length;
  const inactive = total - active;
  return {
    total,
    active,
    inactive,
    activeRate: total === 0 ? 0 : Math.round((active / total) * 100),
  };
}

/* ── Lookup NAME — delegate to lib/references (cached Map, O(1)) ───────
 * Giữ helper có tham số `list` để test/list-local không phụ thuộc Map
 * global; khi có list truyền vào sẽ build Map một lần, không .find() mỗi
 * render. Khi list rỗng hoặc id không có trong list, fallback
 * getSupplierName (cache toàn cục).
 */

export function supplierNameById(list: SupplierDto[], id: string): string {
  if (list.length > 0) {
    const map = new Map(list.map((s) => [s.supplierId, s.name] as const));
    const hit = map.get(id);
    if (hit !== undefined) return hit;
  }
  const global = getSupplierName(id);
  return global !== "—" ? global : id;
}

/* ── Multi-status filter helper for the list table ───────────────────── */

export function filterSupplierByStatus(list: SupplierDto[], statuses: string[]): SupplierDto[] {
  if (!statuses.length) return list;
  return list.filter((s) => statuses.includes(s.status));
}
