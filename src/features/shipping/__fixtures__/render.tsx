/**
 * Render các màn giao hàng cho hãng trong test, với API giả lập theo URL (mẫu receipt).
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { SHIPMENT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver mà Checkbox / Select (radix use-size) dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// …và pointer capture / scrollIntoView mà Radix Select gọi khi mở danh sách.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const SHIP = SHIPMENT_PERMISSIONS;
const ALL = [SHIP.viewPage, SHIP.read, SHIP.create, SHIP.update];

export interface TestActor {
  roles: string[];
  permissions: PermissionCode[];
}

/**
 * Người dùng thử: seed BE cấp `fulfillment-shipments` đủ 4 quyền cho WAREHOUSE_STAFF / WAREHOUSE_MANAGER /
 * ORDER_COORDINATOR, nhưng `@PreAuthorize` mới quyết vai trò nào được làm gì (điều phối đơn không lên xe).
 */
export const SHIPPING_ACTORS = {
  warehouseStaff: { roles: ["WAREHOUSE_STAFF"], permissions: ALL },
  warehouseManager: { roles: ["WAREHOUSE_MANAGER"], permissions: ALL },
  orderCoordinator: { roles: ["ORDER_COORDINATOR"], permissions: ALL },
  viewOnly: { roles: ["SALES_STAFF"], permissions: [SHIP.viewPage, SHIP.read] },
  noAccess: { roles: [], permissions: [] },
} satisfies Record<string, TestActor>;

export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type Routes = Record<string, RouteHandler>;

export const WAREHOUSES = {
  items: [
    { id: "wh-hcm", prefix: "HCM", name: "Kho TP.HCM", status: "ACTIVE" },
    { id: "wh-hn", prefix: "HN", name: "Kho Hà Nội", status: "ACTIVE" },
  ],
};

export const CARRIERS = [
  { carrierId: "car-ghn", code: "GHN", name: "Giao Hàng Nhanh", status: "ACTIVE", version: 0 },
  { carrierId: "car-vtp", code: "VTP", name: "Viettel Post", status: "ACTIVE", version: 0 },
];

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

interface ApiRoutes {
  get?: Routes;
  post?: Routes;
  put?: Routes;
  delete?: Routes;
}

/** Giả lập `api.get/post/put/delete` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockShippingApi(actor: TestActor, routes: ApiRoutes = {}) {
  const missing = (verb: string, url: string) => new Error(`Không có mock cho ${verb} ${url}`);
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: actor.roles, permissions: actor.permissions, dataScope: "ALL" } };
      }
      if (url === "/warehouses") return { data: WAREHOUSES };
      if (url === "/fulfillment/carriers" && !routes.get?.[url]) {
        return { data: bePage(CARRIERS) };
      }
      const handler = routes.get?.[url];
      if (!handler) throw missing("GET", url);
      return { data: handler(config?.params) };
    });
  const withBody = (verb: string, table?: Routes) => async (url: string, body?: unknown) => {
    const handler = table?.[url];
    if (!handler) throw missing(verb, url);
    return { data: handler(undefined, body) };
  };
  const post = vi.spyOn(api, "post").mockImplementation(withBody("POST", routes.post));
  const put = vi.spyOn(api, "put").mockImplementation(withBody("PUT", routes.put));
  const del = vi.spyOn(api, "delete").mockImplementation(async (url: string) => {
    const handler = routes.delete?.[url];
    if (!handler) throw missing("DELETE", url);
    return { data: handler(undefined) };
  });
  return { get, post, put, delete: del };
}

export function renderShippingScreen(ui: React.ReactElement, searchParams = "") {
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
        <TooltipProvider>
          <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
        </TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
