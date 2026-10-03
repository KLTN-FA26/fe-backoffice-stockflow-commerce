/**
 * Mock route — `GET /identity/me/permissions` (BE PR #39), chỉ dùng khi USE_MOCK=true.
 *
 * BE thật tính quyền theo role + bảng quyền admin cấu hình. Mock không có màn cấu hình đó nên
 * dùng bảng dưới đây, chép theo seed BE (V20260903000100 + V20260928006000 + V20260930000100 +
 * V20261001000100 của BE #40). Bảng này CHỈ
 * phục vụ demo/mock — code FE đọc quyền qua `/me/permissions`, không đọc bảng này.
 */

import { PO_PERMISSIONS, SUPPLIER_PERMISSIONS } from "@/constants/permissions";

import { registerMockRoute } from "./mock-adapter";

const ALL_SUPPLIER = Object.values(SUPPLIER_PERMISSIONS);
const ALL_PO = Object.values(PO_PERMISSIONS);
const { viewPage, read, create, update, export: exportCode } = SUPPLIER_PERMISSIONS;
const PO = PO_PERMISSIONS;

const MOCK_PERMISSIONS_BY_ROLE: Record<string, readonly string[]> = {
  "System Admin": [...ALL_SUPPLIER, ...ALL_PO],
  "E-commerce Admin": ALL_SUPPLIER,
  // Seed BE: PROCUREMENT_STAFF — NCC: VIEW_PAGE, READ, CREATE, UPDATE, EXPORT (không DELETE);
  // PO: VIEW_PAGE, READ, CREATE, UPDATE, EXPORT (không APPROVE).
  "Procurement Staff": [
    viewPage,
    read,
    create,
    update,
    exportCode,
    PO.viewPage,
    PO.read,
    PO.create,
    PO.update,
    PO.export,
  ],
  // BE #40: WAREHOUSE_MANAGER duyệt PO (VIEW_PAGE, READ, APPROVE); không có quyền NCC.
  "Warehouse Manager": [PO.viewPage, PO.read, PO.approve],
  Accountant: [viewPage, read],
};

export function registerMeMockRoutes(): void {
  registerMockRoute("GET", "/identity/me/permissions", async () => {
    const { useAuthStore } = await import("@/lib/auth/auth-store");
    const roles = useAuthStore.getState().effectiveRoles();
    const permissions = [
      ...new Set(roles.flatMap((r) => MOCK_PERMISSIONS_BY_ROLE[r] ?? [])),
    ].sort();
    return { status: 200, data: { roles, permissions, dataScope: "ALL" }, headers: {} };
  });
}
