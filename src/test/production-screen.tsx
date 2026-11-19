/**
 * Render màn sản xuất (đơn vị sản xuất, Đơn sản xuất, lịch) trong test với API giả lập theo URL và bộ mã quyền tuỳ ý
 * (mẫu `vehicle-type/__fixtures__/render.tsx`). Dùng chung cho `features/producer` và `features/production-order`.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/production-orders",
}));

export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type Routes = Record<string, RouteHandler>;

interface ApiRoutes {
  get?: Routes;
  post?: Routes;
  put?: Routes;
}

/** Giả lập `api.get/post/put` theo URL; URL không khai báo → lỗi rõ ràng. Trả spy để kiểm body đã gửi. */
export function mockProductionApi(permissions: readonly PermissionCode[], routes: ApiRoutes = {}) {
  const missing = (verb: string, url: string) => new Error(`Không có mock cho ${verb} ${url}`);
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions")
        return { data: { roles: ["TEST"], permissions, dataScope: "ALL" } };
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

export function renderProductionScreen(
  ui: React.ReactElement,
  userId = "u-test",
  searchParams = "",
) {
  useAuthStore.setState({
    user: {
      userId,
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
