/**
 * Quyền mới của hợp đồng sales-owner (§Permissions) cho test màn hình — tách khỏi `ROLE_PERMISSIONS` của `api-screen`
 * để test cũ giữ nguyên bộ quyền của chúng. Khi BE seed vào develop, gộp các mã này vào `ROLE_PERMISSIONS`.
 */

import { mockApi } from "./api-screen";

import type { PermissionCode } from "@/lib/auth";
import type { RouteTable, TestRole } from "./api-screen";

const STAFF: PermissionCode[] = [
  "customer-sales-owners:READ",
  "staff-covers:READ",
  "staff-covers:CREATE",
  "staff-covers:UPDATE",
  "sales-leads:READ",
  "sales-leads:UPDATE",
];

/** Hợp đồng §Permissions: SALES_STAFF / SALES_MANAGER / ACCOUNTANT (SYSTEM_ADMIN = như quản lý). */
export const SALES_OWNER_GRANTS: Partial<Record<TestRole, PermissionCode[]>> = {
  SALES_STAFF: STAFF,
  SALES_MANAGER: [
    ...STAFF,
    "customer-sales-owners:UPDATE",
    "sales-workload:READ",
    "sales-owner-change-requests:READ",
    "sales-owner-change-requests:APPROVE",
  ],
  ACCOUNTANT: ["customer-sales-owners:READ"],
};

interface MeResponse {
  data: { permissions: string[] } & Record<string, unknown>;
}

/** `mockApi` + các mã sales-owner của vai trò (hoặc `extra` truyền vào) trong `/identity/me/permissions`. */
export function mockSalesOwnerApi(
  role: TestRole,
  routes: { get?: RouteTable; post?: RouteTable; put?: RouteTable } = {},
  extra: readonly PermissionCode[] = SALES_OWNER_GRANTS[role] ?? [],
) {
  const spies = mockApi(role, routes);
  const inner = spies.get.getMockImplementation();
  spies.get.mockImplementation(async (...args: Parameters<NonNullable<typeof inner>>) => {
    const response = (await inner?.(...args)) as MeResponse;
    if (args[0] !== "/identity/me/permissions") return response;
    return {
      ...response,
      data: { ...response.data, permissions: [...response.data.permissions, ...extra] },
    };
  });
  return spies;
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
