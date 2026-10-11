/**
 * Render màn đơn hàng trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → usePermissionChecker → UI. Quyền giả lập theo MÃ QUYỀN BE.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { CREDIT_HOLD_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

/**
 * Theo seed BE develop: `sales-orders` APPROVE (release) chỉ ORDER_COORDINATOR;
 * `sales-order-cancellations:UPDATE` cho SALES_STAFF + ORDER_COORDINATOR;
 * `sales-order-credit-holds:APPROVE` chỉ ACCOUNTANT (Sales/Coordinator chỉ READ).
 */
export const ORDER_PERMISSION_SETS = {
  // WAREHOUSE_STAFF: không có quyền đơn bán nào
  none: [],
  viewOnly: [ORDER_PERMISSIONS.viewPage],
  // Chỉ đọc đơn — không huỷ / release / duyệt công nợ
  readOnly: [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  salesStaff: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
  ],
  coordinator: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.release,
    ORDER_PERMISSIONS.cancel,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
  ],
  accountant: [
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CREDIT_HOLD_PERMISSIONS.approve,
  ],
} satisfies Record<string, PermissionCode[]>;

/** Handler theo path: trả data, hoặc throw (vd ApiError) để giả lập lỗi. */
export type RouteHandler = (params: URLSearchParams | undefined) => unknown;

export function mockOrderApiGet(
  permissions: readonly PermissionCode[],
  routes: Record<string, RouteHandler>,
) {
  return vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
      }
      const handler = routes[url];
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      const params = config?.params instanceof URLSearchParams ? config.params : undefined;
      return { data: handler(params) };
    });
}

export function renderOrderScreen(ui: React.ReactElement, searchParams = "") {
  useAuthStore.setState({
    user: { userId: "u-test", fullName: "Test", email: "t@t.vn", roles: [], warehouseIds: [] },
    isAuthenticated: true,
    impersonatedRole: null,
  });
  const client = new QueryClient({
    // retryDelay 0: hook order tự retry lỗi 5xx — test không phải chờ backoff thật
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
