/**
 * Tên vai trò của mock-data → mã vai trò BE (`common/security/Roles.java`). BE trả mã vai trò
 * (`MyPermissionsResponse.roles`, `UserResponse.roles`), không phải tên hiển thị — mock phải khớp.
 * Chỉ dùng trong mock (USE_MOCK=true).
 */

import type { RoleName } from "@/lib/auth/roles";

export const BACKEND_ROLE_BY_MOCK_ROLE: Record<RoleName, string> = {
  "System Admin": "SYSTEM_ADMIN",
  "Procurement Staff": "PROCUREMENT_STAFF",
  "Warehouse Staff": "WAREHOUSE_STAFF",
  "Warehouse Manager": "WAREHOUSE_MANAGER",
  "Inventory Planner": "INVENTORY_PLANNER",
  "QC Staff": "QC_STAFF",
  Accountant: "ACCOUNTANT",
  "E-commerce Admin": "ECOMMERCE_ADMIN",
  "Sales Staff": "SALES_STAFF",
  "Order Coordinator": "ORDER_COORDINATOR",
};

function isMockRoleName(role: string): role is RoleName {
  return Object.hasOwn(BACKEND_ROLE_BY_MOCK_ROLE, role);
}

/** Đổi danh sách vai trò sang mã BE, đã sắp xếp; giá trị đã là mã BE thì giữ nguyên. */
export function toBackendRoles(roles: readonly string[]): string[] {
  return roles
    .map((role) => (isMockRoleName(role) ? BACKEND_ROLE_BY_MOCK_ROLE[role] : role))
    .sort();
}
