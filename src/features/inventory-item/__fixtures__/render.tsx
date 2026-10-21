/**
 * Render màn hồ sơ hàng tồn trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → useCan → UI. Bộ quyền giả lập theo MÃ QUYỀN, không theo vai trò.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { INVENTORY_ITEM_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver / scrollIntoView mà Radix Checkbox / Popover / Select dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const { viewPage, read, update } = INVENTORY_ITEM_PERMISSIONS;

export const ITEM_PERMISSION_SETS = {
  none: [],
  viewOnly: [viewPage],
  readOnly: [viewPage, read],
  editor: [viewPage, read, update],
} satisfies Record<string, PermissionCode[]>;

/** Handler theo path: trả data, hoặc throw (vd ApiError) để giả lập lỗi. */
export type RouteHandler = (params: URLSearchParams) => unknown;

/** `api.get` nhận `config.params` là object thường — chuẩn hoá về URLSearchParams cho handler. */
function toSearchParams(params: unknown): URLSearchParams {
  if (params instanceof URLSearchParams) return params;
  const out = new URLSearchParams();
  if (params && typeof params === "object") {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) out.set(key, String(value));
    }
  }
  return out;
}

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
      return { data: handler(toSearchParams(config?.params)) };
    });
}

export function renderInventoryScreen(ui: React.ReactElement, searchParams = "") {
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
  const result = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

/** Dòng danh sách đúng hình BE `InventoryItemSummaryResponse`. */
export const summaryItem = (over: Record<string, unknown> = {}) => ({
  id: "11111111-0000-4000-8000-000000000001",
  sku: "TSHIRT-RED-M",
  unitOfMeasure: "PCS",
  barcode: "8930000000011",
  storageClass: "NORMAL",
  trackingMode: "NONE",
  policyConfigured: true,
  ...over,
});

export const itemsPage = (items: unknown[] = [summaryItem()], totalElements = items.length) => ({
  items,
  page: 0,
  size: 15,
  totalElements,
  totalPages: totalElements === 0 ? 0 : 1,
  hasNext: false,
  hasPrevious: false,
});
