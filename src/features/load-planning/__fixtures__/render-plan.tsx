/**
 * Render màn kế hoạch xếp xe trong test, với API giả lập theo URL (mẫu `vehicle-type/__fixtures__/render.tsx`):
 * người dùng thử theo seed BE PR #161 (nhân viên kho: xem + lập + sửa; điều phối đơn: chỉ xem), kho + loại xe có sẵn.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { LOAD_PLAN_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver / pointer capture / scrollIntoView mà Select / Dialog (Radix) dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const LP = LOAD_PLAN_PERMISSIONS;

export const LOAD_PLAN_ACTORS = {
  dispatcher: { permissions: [LP.viewPage, LP.read, LP.create, LP.update] as PermissionCode[] },
  viewOnly: { permissions: [LP.viewPage, LP.read] as PermissionCode[] },
  noRead: { permissions: [LP.viewPage] as PermissionCode[] },
  noAccess: { permissions: [] as PermissionCode[] },
};

export type TestActor = (typeof LOAD_PLAN_ACTORS)[keyof typeof LOAD_PLAN_ACTORS];

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

const WAREHOUSES = bePage([
  { id: "WH-HN-01", prefix: "HN", name: "Kho Hà Nội", status: "ACTIVE" },
  { id: "WH-HCM-01", prefix: "HCM", name: "Kho TP.HCM", status: "ACTIVE" },
]);

/** Giả lập `api.get/post/put` theo URL; trả spy để kiểm params / body đã gửi. Kho mặc định có sẵn. */
export function mockLoadPlanApi(actor: TestActor, routes: ApiRoutes = {}) {
  const missing = (verb: string, url: string) => new Error(`Không có mock cho ${verb} ${url}`);
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: actor.permissions, dataScope: "ALL" } };
      }
      const handler = routes.get?.[url];
      if (url === "/warehouses" && !handler) return { data: WAREHOUSES };
      if (!handler) throw missing("GET", url);
      // `await`: un handler có thể trả Promise để test mô phỏng đường truyền chậm / tải lại treo
      return { data: await handler(config?.params) };
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

export function renderLoadPlanScreen(ui: React.ReactElement, searchParams = "") {
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
