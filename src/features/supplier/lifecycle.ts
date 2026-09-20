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
 * can manage suppliers (mode A operational spirit).
 */
export interface SupplierActionDescriptor {
  key: "activate" | "deactivate";
  label: string;
  targetStatus: SupplierStatus;
}

export function allowedSupplierActions(statuses: SupplierStatus[]): SupplierActionDescriptor[] {
  const result: SupplierActionDescriptor[] = [];
  for (const status of statuses) {
    for (const next of SUPPLIER_TRANSITIONS[status] ?? []) {
      result.push({
        key: next === "Inactive" ? "deactivate" : "activate",
        label: next === "Inactive" ? "Vô hiệu hoá" : "Kích hoạt",
        targetStatus: next,
      });
    }
  }
  return result;
}
