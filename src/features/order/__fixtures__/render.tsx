/**
 * Render màn đơn hàng trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → usePermissionChecker → UI. Quyền giả lập theo MÃ QUYỀN BE.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

/**
 * Theo seed BE: ORDER_COORDINATOR có sales-orders:APPROVE (giữ / gỡ giữ / giao thất bại) và
 * sales-order-cancellations:UPDATE (huỷ, đóng phần còn lại); SALES_STAFF có cancellations:UPDATE và
 * sales-order-partial-shipments:UPDATE (cho phép giao một phần, BE PR #150) nhưng không có APPROVE.
 */
export const ORDER_PERMISSION_SETS = {
  // WAREHOUSE_STAFF: không có quyền sales-orders nào
  none: [],
  viewOnly: ["sales-orders:VIEW_PAGE"],
  // Chỉ đọc (tài khoản được cấp VIEW_PAGE + READ, không có quyền thao tác)
  readOnly: ["sales-orders:VIEW_PAGE", "sales-orders:READ"],
  salesStaff: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    ORDER_PERMISSIONS.cancel,
    ORDER_PERMISSIONS.partialShipment,
  ],
  coordinator: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    ORDER_PERMISSIONS.approve,
    ORDER_PERMISSIONS.cancel,
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
      // Lịch sử đơn: mặc định rỗng — test về lịch sử khai báo handler riêng
      if (!handler && url.endsWith("/history")) return { data: [] };
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      const params = config?.params instanceof URLSearchParams ? config.params : undefined;
      return { data: handler(params) };
    });
}

export function renderOrderScreen(ui: React.ReactElement, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@t.vn",
      roles: [],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    isAuthenticated: true,
    status: "authenticated",
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

/** Chọn một option của Radix Select trong jsdom (cần polyfill pointer capture / scrollIntoView). */
export async function pickSelectOption(
  user: { click: (el: Element) => Promise<void> },
  trigger: string | RegExp,
  option: string | RegExp,
) {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  await user.click(await screen.findByRole("combobox", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
}
