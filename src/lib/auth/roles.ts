/**
 * Role Registry — source of truth for role names.
 *
 * Re-exports the `RoleName` type from mock-data and provides the ROLES array
 * for use in permission checks, role switcher, and auth config.
 *
 * Source: docs/00-system-overview §2 "Role Registry"
 */

export type { RoleName } from "@/lib/mock-data";

export const ROLES = [
  "System Admin",
  "Procurement Staff",
  "Warehouse Staff",
  "Warehouse Manager",
  "Inventory Planner",
  "QC Staff",
  "Accountant",
  "E-commerce Admin",
  "Sales Staff",
  "Order Coordinator",
] as const;
