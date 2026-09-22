/**
 * Supplier — lifecycle & status transition rules.
 *
 * Supplier status is simple master-data lifecycle (Active ↔ Inactive) — 2-way.
 * The "block vs warn" policy for deactivating a supplier with open PO is a
 * BACKEND decision (SCRUM-118); UI mirrors the returned ApiError instead of
 * pre-validating client-side.
 */

import type { SupplierStatus } from "./types";

/** Transitions allowed per supplier status. */
export const SUPPLIER_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  Active: ["Inactive"],
  Inactive: ["Active"],
};

/**
 * Actions exposed to UI for a given status.
 * No role gating for supplier master data — any logged-in back-office user
 * can manage suppliers (mode A operational spirit). `role` param kept for
 * API parity with `allowedPoActions(status, role)` so call sites can switch
 * to permission-gated later without changing signatures.
 */
export interface SupplierActionDescriptor {
  key: "activate" | "deactivate";
  label: string;
  targetStatus: SupplierStatus;
}

function actionsForOne(status: SupplierStatus): SupplierActionDescriptor[] {
  const next = SUPPLIER_TRANSITIONS[status];
  if (!next) return [];
  return next.map((s) => ({
    key: s === "Inactive" ? "deactivate" : "activate",
    label: s === "Inactive" ? "Vô hiệu hoá" : "Kích hoạt",
    targetStatus: s,
  }));
}

/** Single-status form — preferred; mirrors `allowedPoActions(status, role)`. */
export function allowedSupplierActionsForStatus(
  status: SupplierStatus,
  _role?: unknown,
): SupplierActionDescriptor[] {
  return actionsForOne(status);
}

/**
 * Multi-status form — collects actions for a set of selected statuses.
 * Kept for list/bulk contexts; prefer `allowedSupplierActionsForStatus` in
 * detail views.
 */
export function allowedSupplierActions(
  statuses: SupplierStatus[],
  _role?: unknown,
): SupplierActionDescriptor[] {
  return statuses.flatMap((s) => actionsForOne(s));
}

/** Alias matching `feature-architecture.md` naming (`allowedActions`). */
export const allowedActions = allowedSupplierActionsForStatus;
