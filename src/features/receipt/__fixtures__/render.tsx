/**
 * Render màn phiếu nhận trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → useCan → UI. Bộ quyền chép seed BE V20260903000100 + V20260929000100.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  GOODS_RECEIPT_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  STOCK_PACKAGE_PERMISSIONS as SP,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

const GR = GOODS_RECEIPT_PERMISSIONS;
const GR_WORK = [GR.viewPage, GR.read, GR.create, GR.update];

export const RECEIPT_ROLE_PERMISSIONS = {
  viewOnly: [GR.viewPage],
  // Xem phiếu nhưng không sửa (vd kế toán / Sales tra cứu)
  reader: [GR.viewPage, GR.read],
  // Seed BE: WAREHOUSE_STAFF — goods-receipts + inventory-inventory-items:READ (V20260928006000)
  // + seed V20261020000700: NV kho xem / in / in lại nhãn thùng (inventory-stock-packages VIEW_PAGE, READ, CREATE)
  warehouseStaff: [...GR_WORK, INVENTORY_ITEM_PERMISSIONS.read, SP.viewPage, SP.read, SP.create],
  // Seed BE: WAREHOUSE_MANAGER — goods-receipts + thùng (cả UPDATE)
  warehouseManager: [
    ...GR_WORK,
    INVENTORY_ITEM_PERMISSIONS.read,
    SP.viewPage,
    SP.read,
    SP.create,
    SP.update,
  ],
  // Xem phiếu và thùng nhưng không in nhãn
  cartonViewer: [GR.viewPage, GR.read, SP.viewPage, SP.read],
} satisfies Record<string, PermissionCode[]>;

export type RouteHandler = (params: unknown, body?: unknown) => unknown;

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockReceiptApi(
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
    return { data: handler(undefined, body), headers: {} };
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => {
    const handler = putRoutes[url];
    if (!handler) throw new Error(`Không có mock cho PUT ${url}`);
    return { data: handler(undefined, body) };
  });
  return { get, post, put };
}

export function renderReceiptScreen(ui: React.ReactElement, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@t.vn",
      roles: [],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
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
