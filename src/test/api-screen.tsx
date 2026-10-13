/**
 * Render một màn có API giả lập theo URL — đi qua chuỗi thật `/identity/me/permissions` → useCan
 * → UI (mẫu `features/receipt/__fixtures__/render.tsx`, dùng chung cho các module bán hàng / sản xuất).
 * Bộ quyền theo vai trò lấy từ phiên BE throwaway d215f6e (`/identity/me/permissions` thật,
 * 2026-10-14) — xem `ROLE_PERMISSIONS`.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

/** Quyền thật (đã lọc theo resource liên quan) đọc từ BE d215f6e cho từng vai trò seed. */
export const ROLE_PERMISSIONS = {
  SALES_STAFF: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "customer-customers:CREATE",
    "customer-customers:UPDATE",
    "customer-customers:APPROVE",
    "customer-credit-profiles:VIEW_PAGE",
    "customer-credit-profiles:READ",
    "customer-addresses:READ",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quotes:CREATE",
    "sales-quotes:UPDATE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-sample-requests:CREATE",
    "production-sample-requests:UPDATE",
    "production-sample-requests:APPROVE",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-qc-results:READ",
    "sales-orders:READ",
  ],
  ECOMMERCE_ADMIN: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "customer-customers:CREATE",
    "customer-customers:UPDATE",
    "customer-customers:APPROVE",
    "customer-addresses:READ",
  ],
  ORDER_COORDINATOR: [
    "customer-credit-profiles:READ",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quotes:UPDATE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "sales-orders:APPROVE",
  ],
  PRODUCTION_STAFF: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-orders:UPDATE",
    "production-material-issues:READ",
    "production-qc-results:READ",
  ],
  WAREHOUSE_STAFF: [
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-material-issues:READ",
    "production-material-issues:CREATE",
    "warehouse-warehouses:READ",
    "warehouse-locations:READ",
  ],
  WAREHOUSE_MANAGER: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-orders:CREATE",
    "production-orders:UPDATE",
    "production-orders:APPROVE",
    "production-material-issues:READ",
    "production-material-issues:CREATE",
    "production-qc-results:READ",
    "production-qc-results:CREATE",
    "warehouse-warehouses:READ",
    "warehouse-locations:READ",
  ],
  QC_STAFF: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-qc-results:READ",
    "production-qc-results:CREATE",
  ],
  CUSTOMER: [
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quotes:APPROVE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-sample-requests:APPROVE",
  ],
} satisfies Record<string, PermissionCode[]>;

export type TestRole = keyof typeof ROLE_PERMISSIONS;
export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type RouteTable = Record<string, RouteHandler>;

/** Lỗi BE dạng ApiError để route giả lập ném ra. */
export function apiError(status: number, code: string, fieldErrors?: Record<string, string>) {
  return new ApiError(status, code, code, fieldErrors);
}

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm tra params / body đã gửi. */
export function mockApi(
  role: TestRole,
  routes: { get?: RouteTable; post?: RouteTable; put?: RouteTable } = {},
) {
  const wrap =
    (table: RouteTable | undefined, method: string) =>
    async (url: string, bodyOrConfig?: unknown, config?: { params?: unknown }) => {
      if (method === "GET" && url === "/identity/me/permissions") {
        return {
          data: { roles: [role], permissions: [...ROLE_PERMISSIONS[role]], dataScope: "ALL" },
        };
      }
      const handler = table?.[url];
      if (!handler) throw new Error(`Không có mock cho ${method} ${url}`);
      const params =
        method === "GET"
          ? (bodyOrConfig as { params?: unknown } | undefined)?.params
          : config?.params;
      const body = method === "GET" ? undefined : bodyOrConfig;
      return { data: await handler(params, body) };
    };
  const get = vi.spyOn(api, "get").mockImplementation(wrap(routes.get, "GET"));
  const post = vi.spyOn(api, "post").mockImplementation(wrap(routes.post, "POST"));
  const put = vi.spyOn(api, "put").mockImplementation(wrap(routes.put, "PUT"));
  return { get, post, put };
}

export function renderScreen(ui: React.ReactElement, role: TestRole, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@example.com",
      roles: [role],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

/** PageResponse BE (trang từ 0). */
export function bePage<T>(items: T[], page = 0, size = 15) {
  return {
    items,
    page,
    size,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: page > 0,
  };
}
