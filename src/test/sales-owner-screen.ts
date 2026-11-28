/**
 * Quyền mới của hợp đồng sales-owner (§Permissions) cho test màn hình — tách khỏi `ROLE_PERMISSIONS` của `api-screen`
 * để test cũ giữ nguyên bộ quyền của chúng. Khi BE seed vào develop, gộp các mã này vào `ROLE_PERMISSIONS`.
 *
 * Hai cách cấp, cùng MỘT nguồn mã quyền (`@/constants/sales-owner`): `mockSalesOwnerApi(role)` cấp cả bộ của vai trò
 * (màn phân công, thẻ khách); một test cần đúng một hai mã thì `mockApi(role, routes, { extra: [SALES_OWNER_READ] })`.
 */

import {
  OWNER_CHANGE_REQUEST_PERMISSIONS,
  SALES_LEAD_PERMISSIONS,
  SALES_OWNER_PERMISSIONS,
  SALES_WORKLOAD_PERMISSIONS,
  STAFF_COVER_PERMISSIONS,
} from "@/constants/sales-owner";

import { mockApi } from "./api-screen";

import type { PermissionCode } from "@/lib/auth";
import type { RouteTable, TestRole } from "./api-screen";

/** Đọc người phụ trách (`customer-sales-owners:READ`). */
export const SALES_OWNER_READ: PermissionCode = SALES_OWNER_PERMISSIONS.read;
/** "Người quản lý" của BR-S12 trên FE (`customer-sales-owners:UPDATE`). */
export const SALES_OWNER_MANAGE: PermissionCode = SALES_OWNER_PERMISSIONS.update;

const STAFF: PermissionCode[] = [
  SALES_OWNER_PERMISSIONS.read,
  ...Object.values(STAFF_COVER_PERMISSIONS),
  ...Object.values(SALES_LEAD_PERMISSIONS),
];

/** Hợp đồng §Permissions: SALES_STAFF / SALES_MANAGER / ACCOUNTANT (SYSTEM_ADMIN = như quản lý). */
export const SALES_OWNER_GRANTS: Partial<Record<TestRole, PermissionCode[]>> = {
  SALES_STAFF: STAFF,
  SALES_MANAGER: [
    ...STAFF,
    SALES_OWNER_PERMISSIONS.update,
    SALES_WORKLOAD_PERMISSIONS.read,
    ...Object.values(OWNER_CHANGE_REQUEST_PERMISSIONS),
  ],
  ACCOUNTANT: [SALES_OWNER_PERMISSIONS.read],
};

/** `mockApi` + các mã sales-owner của vai trò (hoặc `extra` truyền vào) trong `/identity/me/permissions`. */
export function mockSalesOwnerApi(
  role: TestRole,
  routes: { get?: RouteTable; post?: RouteTable; put?: RouteTable } = {},
  extra: readonly PermissionCode[] = SALES_OWNER_GRANTS[role] ?? [],
) {
  return mockApi(role, routes, { extra });
}

/** Một dòng bảng tải (`GET /sales/workload`). */
export const workloadRow = (userId: string, name: string, extra: Record<string, unknown> = {}) => ({
  userId,
  name,
  paused: false,
  capacityPerMonth: null,
  onLeave: false,
  customers: 10,
  customersWithOpenOrders: 2,
  openQuotes: 1,
  contractsAwaitingSignature: 0,
  revenue30d: 120_000_000,
  newCustomersThisMonth: 1,
  ...extra,
});

/** Một dòng `GET /customers/sales-agents` (D42: Sale giao được). */
export const salesAgent = (userId: string, name: string, extra: Record<string, unknown> = {}) => ({
  userId,
  name,
  paused: false,
  onLeave: false,
  coverUntil: null,
  ...extra,
});

/** `GET /customers/sales-agents` dựng từ các dòng bảng tải của cùng test (cùng người, cùng trạng thái). */
export const agentsOf = (rows: readonly Record<string, unknown>[]) =>
  rows.map((row) =>
    salesAgent(String(row.userId), String(row.name), {
      paused: row.paused ?? false,
      onLeave: row.onLeave ?? false,
      coverUntil: row.coverUntil ?? null,
    }),
  );
