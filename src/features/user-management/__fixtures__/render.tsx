/**
 * Render màn Người dùng trong test với API giả lập theo `METHOD /path` — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → useCan → UI. Bộ quyền theo MÃ QUYỀN, không theo vai trò.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Suspense } from "react";
import { vi } from "vitest";

import { IDENTITY_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { rawRoles, rawWarehouses } from "./users";

import type { PermissionCode } from "@/lib/auth";

// jsdom thiếu các API mà Radix Select / Checkbox / Dialog dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.setPointerCapture ??= () => {};

const P = IDENTITY_PERMISSIONS;
export const PERMISSION_SETS = {
  none: [],
  readOnly: [P.usersRead, P.rolesRead, WAREHOUSE_PERMISSIONS.read],
  editor: [P.usersRead, P.usersUpdate, P.rolesRead, WAREHOUSE_PERMISSIONS.read],
  full: [P.usersRead, P.usersCreate, P.usersUpdate, P.rolesRead, WAREHOUSE_PERMISSIONS.read],
  noRolesRead: [P.usersRead, P.usersCreate, P.usersUpdate, WAREHOUSE_PERMISSIONS.read],
  noWarehouseRead: [P.usersRead, P.usersCreate, P.usersUpdate, P.rolesRead],
} satisfies Record<string, PermissionCode[]>;

export interface ApiCall {
  method: "get" | "post" | "put" | "patch" | "delete";
  url: string;
  body?: unknown;
  params?: URLSearchParams;
}
export type Handler = (call: ApiCall) => unknown;

/** Mọi lời gọi `api.*` đi vào `routes["METHOD /path"]`; handler có thể `throw new ApiError(...)`. */
export function stubIdentityApi(
  permissions: readonly PermissionCode[],
  routes: Record<string, Handler>,
) {
  const calls: ApiCall[] = [];
  const dispatch = async (
    method: ApiCall["method"],
    url: string,
    body?: unknown,
    config?: unknown,
  ) => {
    const params = (config as { params?: unknown } | undefined)?.params;
    const call: ApiCall = {
      method,
      url,
      body,
      params: params instanceof URLSearchParams ? params : undefined,
    };
    if (method === "get" && url === "/identity/me/permissions") {
      return { data: { roles: [], permissions: [...permissions], dataScope: "ALL" } };
    }
    const defaults: Record<string, Handler> = {
      "GET /identity/roles": () => rawRoles,
      "GET /warehouses": () => rawWarehouses,
    };
    // The detail page always asks for the status history (SCRUM-474); a test that does not care gets an empty page.
    if (method === "get" && /^\/identity\/users\/[^/]+\/status-changes$/.test(url))
      defaults[`GET ${url}`] = () => ({
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });
    const handler =
      routes[`${method.toUpperCase()} ${url}`] ?? defaults[`${method.toUpperCase()} ${url}`];
    if (!handler) throw new Error(`Không có mock cho ${method.toUpperCase()} ${url}`);
    calls.push(call);
    return { data: handler(call) };
  };
  vi.spyOn(api, "get").mockImplementation((url, config) => dispatch("get", url, undefined, config));
  vi.spyOn(api, "post").mockImplementation((url, body) => dispatch("post", url, body));
  vi.spyOn(api, "put").mockImplementation((url, body) => dispatch("put", url, body));
  vi.spyOn(api, "patch").mockImplementation((url, body) => dispatch("patch", url, body));
  vi.spyOn(api, "delete").mockImplementation((url) => dispatch("delete", url));
  return {
    calls,
    of: (method: ApiCall["method"], url: string) =>
      calls.filter((c) => c.method === method && c.url === url),
  };
}

export function renderIdentityScreen(
  ui: React.ReactElement,
  searchParams = "",
  userId = "u-admin",
) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "Admin",
      email: "a@t.vn",
      roles: [],
      username: "admin",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
