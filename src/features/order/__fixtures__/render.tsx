/**
 * Render màn đơn hàng trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → usePermissionChecker → UI. Quyền giả lập theo MÃ QUYỀN BE.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  ORDER_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

/**
 * Theo seed BE develop (5683fe14):
 * - `sales-orders:APPROVE` (release, giữ / gỡ giữ / giao thất bại) chỉ ORDER_COORDINATOR;
 * - `sales-order-cancellations:UPDATE` (huỷ, đóng phần còn lại) cho SALES_STAFF + ORDER_COORDINATOR;
 * - `sales-order-partial-shipments:UPDATE` (cho phép giao một phần, BE PR #150) cho SALES_STAFF, không có APPROVE;
 * - `sales-order-credit-holds:APPROVE` chỉ ACCOUNTANT (Sales/Coordinator chỉ VIEW_PAGE / READ);
 * - `customer-credit-profiles:READ` cho ACCOUNTANT / SALES_STAFF / ORDER_COORDINATOR (V20261013000400).
 */
export const ORDER_PERMISSION_SETS = {
  // WAREHOUSE_STAFF: không có quyền đơn bán nào
  none: [],
  viewOnly: [ORDER_PERMISSIONS.viewPage],
  // Chỉ đọc đơn (VIEW_PAGE + READ) — không huỷ / release / giữ / duyệt công nợ
  readOnly: [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  salesStaff: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    ORDER_PERMISSIONS.partialShipment,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    // BE V20261010000500: SALES_STAFF + ORDER_COORDINATOR có production-orders READ (ACCOUNTANT không)
    PRODUCTION_ORDER_PERMISSIONS.read,
  ],
  coordinator: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    // `approve` và `release` cùng mã sales-orders:APPROVE — giữ cả hai tên cho rõ nghĩa
    ORDER_PERMISSIONS.approve,
    ORDER_PERMISSIONS.release,
    ORDER_PERMISSIONS.cancel,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    PRODUCTION_ORDER_PERMISSIONS.read,
  ],
  accountant: [
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CREDIT_HOLD_PERMISSIONS.approve,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
  ],
  // Seed BE PR #157: ORDER_COORDINATOR có thêm sales-order-delivery-modes:UPDATE (chọn / đổi hình thức giao).
  // Giữ `coordinator` ở trên không có mã này để test "thiếu quyền → chỉ đọc".
  coordinatorWithModes: [
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    ORDER_PERMISSIONS.approve,
    ORDER_PERMISSIONS.cancel,
    ORDER_PERMISSIONS.deliveryModes,
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

/**
 * Chọn một option của Radix Select trong jsdom (thiếu pointer-capture / scrollIntoView).
 * Bản riêng của order — không import fixture của feature khác (feature-architecture).
 */
export async function pickOrderSelectOption(
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

/** Cùng helper, tên develop dùng trong test vòng đời. */
export const pickSelectOption = pickOrderSelectOption;
