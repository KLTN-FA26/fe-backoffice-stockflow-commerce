/**
 * Permission map — which roles can perform which actions.
 *
 * Each key is a `<module>.<action>` string. Values are arrays of roles
 * that have that permission.  `System Admin` always has access (handled
 * in `can()` below).
 *
 * Source: docs/00-system-overview §2 + each module §2 "Vai trò liên quan"
 *
 * **UI-only**: ẩn/disable nút. Luôn kèm server re-check.
 */

import type { RoleName } from "./roles";

/* ── Permission type ─────────────────────────────────────────────────── */

export type Permission = keyof typeof PERMISSIONS;

/* ── Permission map ──────────────────────────────────────────────────── */

export const PERMISSIONS = {
  // ── Module 01: Products ──────────────────────────────────────────
  "product.view":           ["Procurement Staff", "Warehouse Manager", "Inventory Planner", "E-commerce Admin", "Sales Staff"] as RoleName[],
  "product.create":         ["E-commerce Admin"] as RoleName[],
  "product.approve":        ["E-commerce Admin"] as RoleName[],
  "product.edit":           ["E-commerce Admin"] as RoleName[],
  "variant.manage":         ["E-commerce Admin"] as RoleName[],

  // ── Module 02: Purchase Orders ───────────────────────────────────
  "po.view":                ["Procurement Staff", "Warehouse Manager", "Inventory Planner", "Accountant"] as RoleName[],
  "po.create":              ["Procurement Staff"] as RoleName[],
  "po.approve":             ["Warehouse Manager"] as RoleName[],
  "po.confirm":             ["Procurement Staff"] as RoleName[],
  "po.cancel":              ["Procurement Staff", "Warehouse Manager"] as RoleName[],

  // ── Module 03: Receipt ───────────────────────────────────────────
  "receipt.view":           ["Warehouse Staff", "Warehouse Manager", "QC Staff", "Procurement Staff"] as RoleName[],
  "receipt.create":         ["Warehouse Staff", "Warehouse Manager"] as RoleName[],
  "receipt.confirm":        ["Warehouse Staff", "Warehouse Manager"] as RoleName[],
  "receipt.qc":             ["QC Staff", "Warehouse Manager"] as RoleName[],

  // ── Module 04: Invoice ───────────────────────────────────────────
  "invoice.view":           ["Accountant", "Procurement Staff"] as RoleName[],
  "invoice.create":         ["Accountant"] as RoleName[],
  "invoice.match":          ["Accountant"] as RoleName[],
  "invoice.approvePayment": ["Accountant"] as RoleName[],

  // ── Module 05: Putaway ───────────────────────────────────────────
  "putaway.view":           ["Warehouse Staff", "Warehouse Manager"] as RoleName[],
  "putaway.execute":        ["Warehouse Staff"] as RoleName[],
  "putaway.override":       ["Warehouse Manager"] as RoleName[],

  // ── Module 06: Map & Slotting ────────────────────────────────────
  "map.view":               ["Warehouse Staff", "Warehouse Manager", "Inventory Planner"] as RoleName[],
  "slotting.suggest":       ["Inventory Planner"] as RoleName[],
  "slotting.approve":       ["Warehouse Manager"] as RoleName[],
  "slotting.override":      ["Warehouse Staff", "Warehouse Manager"] as RoleName[],

  // ── Module 07: Picking ───────────────────────────────────────────
  "pick.view":              ["Warehouse Staff", "Warehouse Manager", "Order Coordinator"] as RoleName[],
  "pick.execute":           ["Warehouse Staff"] as RoleName[],
  "pick.assign":            ["Warehouse Manager", "Order Coordinator"] as RoleName[],

  // ── Module 08: Packing ───────────────────────────────────────────
  "pack.view":              ["Warehouse Staff", "Warehouse Manager", "Order Coordinator"] as RoleName[],
  "pack.execute":           ["Warehouse Staff"] as RoleName[],

  // ── Module 09: Shipping ──────────────────────────────────────────
  "shipment.view":          ["Warehouse Staff", "Warehouse Manager", "Order Coordinator", "Sales Staff"] as RoleName[],
  "shipment.create":        ["Warehouse Staff", "Order Coordinator"] as RoleName[],
  "shipment.handover":      ["Warehouse Staff"] as RoleName[],

  // ── Module 10: Inter-warehouse Transfer ──────────────────────────
  "transfer.view":          ["Warehouse Manager", "Inventory Planner"] as RoleName[],
  "transfer.create":        ["Warehouse Manager"] as RoleName[],
  "transfer.approve":       ["Warehouse Manager"] as RoleName[],

  // ── Module 11: Intra-warehouse Move ──────────────────────────────
  "move.view":              ["Warehouse Staff", "Warehouse Manager"] as RoleName[],
  "move.execute":           ["Warehouse Staff"] as RoleName[],

  // ── Cross-cutting ────────────────────────────────────────────────
  "dashboard.view":         ["Warehouse Manager", "Inventory Planner", "Procurement Staff", "Accountant", "E-commerce Admin", "Order Coordinator"] as RoleName[],
  "inventory.view":         ["Warehouse Staff", "Warehouse Manager", "Inventory Planner"] as RoleName[],
  "inventory.adjust":       ["Warehouse Manager"] as RoleName[],
  "report.view":            ["Warehouse Manager", "Inventory Planner", "Accountant"] as RoleName[],
  "replenishment.view":     ["Procurement Staff", "Inventory Planner", "Warehouse Manager"] as RoleName[],
  "replenishment.create":   ["Inventory Planner"] as RoleName[],
  "replenishment.approve":  ["Warehouse Manager"] as RoleName[],
} as const;

/* ── Check function ──────────────────────────────────────────────────── */

/**
 * Check if a role has a specific permission.
 * System Admin always returns true.
 */
export function can(role: RoleName | RoleName[], perm: Permission): boolean {
  const roles = Array.isArray(role) ? role : [role];
  if (roles.includes("System Admin")) return true;
  const allowed = PERMISSIONS[perm];
  return roles.some((r) => (allowed as readonly string[]).includes(r));
}

/**
 * Get all permissions a role (or set of roles) has.
 */
export function permissionsFor(role: RoleName | RoleName[]): Permission[] {
  const roles = Array.isArray(role) ? role : [role];
  if (roles.includes("System Admin")) {
    return Object.keys(PERMISSIONS) as Permission[];
  }
  return (Object.entries(PERMISSIONS) as [Permission, readonly RoleName[]][])
    .filter(([, allowed]) => roles.some((r) => allowed.includes(r)))
    .map(([perm]) => perm);
}
