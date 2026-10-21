/**
 * Render màn NCC trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → useCan → UI. Bộ quyền giả lập theo MÃ QUYỀN, không theo vai trò.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  INVENTORY_ITEM_PERMISSIONS,
  SUPPLIER_ITEM_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver / scrollIntoView mà Radix Checkbox (ô "NCC ưu tiên") / Popover dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const { viewPage, read, create, update } = SUPPLIER_PERMISSIONS;
const ITEM = SUPPLIER_ITEM_PERMISSIONS;
const ITEM_WRITE = [viewPage, read, create, update, ...Object.values(SUPPLIER_ITEM_PERMISSIONS)];

export const PERMISSION_SETS = {
  none: [],
  // VIEW_PAGE = được mở trang (menu + route); READ = được đọc dữ liệu (BE ADR-0004)
  viewOnly: [viewPage],
  readNoPage: [read],
  readOnly: [viewPage, read],
  editor: [viewPage, read, create, update],
  full: Object.values(SUPPLIER_PERMISSIONS),
  // Seed BE V20260928006000: chỉ PROCUREMENT_STAFF có đủ 5 action `procurement-supplier-items`,
  // kèm VIEW_PAGE / READ `inventory-inventory-items` (ô chọn SKU theo hồ sơ hàng tồn)
  procurementStaff: [
    ...ITEM_WRITE,
    INVENTORY_ITEM_PERMISSIONS.viewPage,
    INVENTORY_ITEM_PERMISSIONS.read,
  ],
  // Bị gỡ quyền đọc hồ sơ hàng tồn → ô SKU gõ tay
  procurementNoInventory: ITEM_WRITE,
  itemsReadOnly: [viewPage, read, ITEM.viewPage, ITEM.read],
  // ACCOUNTANT: xem được NCC nhưng không có `procurement-supplier-items`
  accountant: [viewPage, read],
} satisfies Record<string, PermissionCode[]>;

/** Handler theo path: trả data, hoặc throw (vd ApiError) để giả lập lỗi. */
export type RouteHandler = (params: URLSearchParams | undefined) => unknown;

export function mockApiGet(
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

export function renderSupplierScreen(ui: React.ReactElement, searchParams = "") {
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
  const view = render(
    <QueryClientProvider client={client}>
      {/* hasMemory: setUrl (đổi trang, tab) cập nhật state như trên trình duyệt */}
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  // `client` để test kích refetch nền (vd refetch lỗi khi đã có data)
  return { ...view, client };
}
