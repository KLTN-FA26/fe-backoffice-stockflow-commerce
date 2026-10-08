/**
 * Mock route — `GET /identity/me/permissions` (BE PR #39), chỉ dùng khi USE_MOCK=true.
 *
 * BE thật tính quyền theo role + bảng quyền admin cấu hình. Mock không có màn cấu hình đó nên
 * dùng bảng dưới đây, chép theo seed BE (V20260928006000 + V20260930000100). Bảng này CHỈ
 * phục vụ demo/mock — code FE đọc quyền qua `/me/permissions`, không đọc bảng này.
 */

import { INVENTORY_PERMISSIONS, SUPPLIER_PERMISSIONS } from "@/constants/permissions";

import { registerMockRoute } from "./mock-adapter";

const ALL_SUPPLIER = Object.values(SUPPLIER_PERMISSIONS);
const { viewPage, read, create, update, export: exportCode } = SUPPLIER_PERMISSIONS;
const stockRead = Object.values(INVENTORY_PERMISSIONS.stock);
const reservationRead = Object.values(INVENTORY_PERMISSIONS.reservations);
const inventoryRead = [...stockRead, ...reservationRead];

const MOCK_PERMISSIONS_BY_ROLE: Record<string, readonly string[]> = {
  "System Admin": [...ALL_SUPPLIER, ...inventoryRead],
  "E-commerce Admin": ALL_SUPPLIER,
  // Seed BE: PROCUREMENT_STAFF có VIEW_PAGE, READ, CREATE, UPDATE, EXPORT (không DELETE)
  "Procurement Staff": [viewPage, read, create, update, exportCode],
  Accountant: [viewPage, read],
  // BE V20260903000100: floor roles read both resources; planner and QC read stock only.
  "Warehouse Staff": inventoryRead,
  "Warehouse Manager": inventoryRead,
  "Inventory Planner": stockRead,
  "QC Staff": stockRead,
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
