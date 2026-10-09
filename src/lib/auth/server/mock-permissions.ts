import "server-only";

import {
  IDENTITY_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants/permissions";

import type { PermissionCode } from "@/lib/auth/me-permissions";

/** Explicit demo session responses keyed by existing staff IDs, never computed from roles. */
const MOCK_USER_GRANTS: Record<string, readonly PermissionCode[]> = {
  "USER-ADMIN-01": [
    ...Object.values(SUPPLIER_PERMISSIONS),
    ...Object.values(PO_PERMISSIONS),
    ...Object.values(ORDER_PERMISSIONS),
    ...Object.values(PRODUCT_PERMISSIONS),
    ...Object.values(IDENTITY_PERMISSIONS),
  ],
  "USER-PROC-01": [
    SUPPLIER_PERMISSIONS.viewPage,
    SUPPLIER_PERMISSIONS.read,
    SUPPLIER_PERMISSIONS.create,
    SUPPLIER_PERMISSIONS.update,
    SUPPLIER_PERMISSIONS.export,
    PO_PERMISSIONS.viewPage,
    PO_PERMISSIONS.read,
    PO_PERMISSIONS.create,
    PO_PERMISSIONS.update,
    PO_PERMISSIONS.export,
  ],
  "USER-PLAN-01": [],
  "USER-WH-01": [],
  "USER-WH-02": [],
  "USER-WH-03": [],
  "USER-WH-04": [],
  "USER-QC-01": [],
  "USER-ACC-01": [SUPPLIER_PERMISSIONS.viewPage, SUPPLIER_PERMISSIONS.read],
  "USER-ECAD-01": [...Object.values(PRODUCT_PERMISSIONS), ...Object.values(SUPPLIER_PERMISSIONS)],
  "USER-SALE-01": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  "USER-SALE-02": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  "USER-SALE-03": [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  "USER-COORD-01": Object.values(ORDER_PERMISSIONS),
};

export function mockSessionPermissions(userId: string, roles: readonly string[]) {
  return {
    roles: [...roles],
    permissions: [...(MOCK_USER_GRANTS[userId] ?? [])].sort(),
    dataScope: "ALL" as const,
  };
}
