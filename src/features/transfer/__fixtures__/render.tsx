/**
 * Render màn chuyển kho trong test với API giả lập theo URL (mẫu `receipt/__fixtures__/render.tsx`):
 * `/identity/me/permissions` → useCan → UI. Người dùng hiện tại: `u-test`.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS as PACKAGES,
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
  LOAD_PLAN_PERMISSIONS as LP,
  TRANSFER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

const TO = TRANSFER_PERMISSIONS;

/** Test render cả màn + react-query + userEvent: máy CI / máy đang tải nặng có thể vượt mốc 5s mặc định. */
export const HEAVY_TEST = { timeout: 15_000 };

/** Seed BE V20260903000100 + V20261010000500 cho resource `inventory-transfer-orders`. */
export const TRANSFER_ROLE_PERMISSIONS = {
  viewOnly: [TO.viewPage, TO.read],
  warehouseManager: [TO.viewPage, TO.read, TO.create, TO.update, TO.approve],
  inventoryPlanner: [TO.viewPage, TO.read, TO.create, TO.update],
  warehouseStaff: [TO.viewPage, TO.read, TO.update],
  // BE PR #164 + seed fulfillment: nhân viên kho đóng gói (packing:UPDATE + packages:READ) và lập kế hoạch xe (load-plans)
  floorStaff: [
    TO.viewPage,
    TO.read,
    TO.update,
    PACKING.update,
    PACKING.read,
    PACKAGES.viewPage,
    PACKAGES.read,
    LP.viewPage,
    LP.read,
    LP.create,
    LP.update,
  ],
  // Đóng gói được nhưng không lập kế hoạch xe
  packerOnly: [TO.viewPage, TO.read, TO.update, PACKING.update, PACKAGES.read],
  // Lập kế hoạch xe được nhưng không đóng gói
  plannerOnly: [TO.viewPage, TO.read, TO.update, LP.read, LP.create],
} satisfies Record<string, PermissionCode[]>;

export type RouteHandler = (params: unknown, body?: unknown) => unknown;

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockTransferApi(
  permissions: readonly PermissionCode[],
  getRoutes: Record<string, RouteHandler>,
  postRoutes: Record<string, RouteHandler> = {},
  putRoutes: Record<string, RouteHandler> = {},
) {
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
      }
      const handler = getRoutes[url];
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      return { data: handler(config?.params) };
    });
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string, body?: unknown) => {
    const handler = postRoutes[url];
    if (!handler) throw new Error(`Không có mock cho POST ${url}`);
    return { data: handler(undefined, body) };
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => {
    const handler = putRoutes[url];
    if (!handler) throw new Error(`Không có mock cho PUT ${url}`);
    return { data: handler(undefined, body) };
  });
  return { get, post, put };
}

export function renderTransferScreen(ui: React.ReactElement, searchParams = "") {
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
