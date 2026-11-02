/**
 * Render màn danh mục loại xe trong test, với API giả lập theo URL (mẫu shipping).
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { VEHICLE_TYPE_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver / pointer capture / scrollIntoView mà Select (Radix) dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const VT = VEHICLE_TYPE_PERMISSIONS;

/**
 * Người dùng thử theo seed BE PR #153: nhân viên kho / điều phối chỉ xem (VIEW_PAGE + READ), quản lý
 * kho thêm UPDATE. FE chỉ đọc mã quyền, không đọc tên vai trò.
 */
export const VEHICLE_TYPE_ACTORS = {
  warehouseManager: { permissions: [VT.viewPage, VT.read, VT.update] as PermissionCode[] },
  viewOnly: { permissions: [VT.viewPage, VT.read] as PermissionCode[] },
  noRead: { permissions: [VT.viewPage] as PermissionCode[] },
  noAccess: { permissions: [] as PermissionCode[] },
};

export type TestActor = (typeof VEHICLE_TYPE_ACTORS)[keyof typeof VEHICLE_TYPE_ACTORS];

export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type Routes = Record<string, RouteHandler>;

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
}

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockVehicleTypeApi(actor: TestActor, routes: ApiRoutes = {}) {
  const missing = (verb: string, url: string) => new Error(`Không có mock cho ${verb} ${url}`);
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: actor.permissions, dataScope: "ALL" } };
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
  return { get, post, put };
}

export function renderVehicleTypeScreen(ui: React.ReactElement, searchParams = "") {
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
        <TooltipProvider>
          <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
        </TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
