/**
 * Supplier — pure selectors for stats & derived states.
 */

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

/* ── Lookup NAME for usage in list table ─────────────────────────────── */

export function supplierNameById(list: SupplierDto[], id: string): string {
  return list.find((s) => s.supplierId === id)?.name ?? id;
}

/* ── Multi-status filter helper for the list table ───────────────────── */

export function filterSupplierByStatus(list: SupplierDto[], statuses: string[]): SupplierDto[] {
  if (!statuses.length) return list;
  return list.filter((s) => statuses.includes(s.status));
}
