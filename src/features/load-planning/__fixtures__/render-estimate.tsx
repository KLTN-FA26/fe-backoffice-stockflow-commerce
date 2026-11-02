/**
 * Render ngăn kéo / nút ước tính trong test: quyền giả lập theo MÃ QUYỀN BE qua `/identity/me/permissions`, các GET
 * khác theo URL — đi qua đúng chuỗi thật (hook quyền → UI), không gọi mạng.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";

import { LOAD_ESTIMATE_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

export const ESTIMATE_PERMISSION_SETS = {
  none: [],
  readOnly: [LOAD_ESTIMATE_PERMISSIONS.read],
  createOnly: [LOAD_ESTIMATE_PERMISSIONS.create],
  full: [LOAD_ESTIMATE_PERMISSIONS.read, LOAD_ESTIMATE_PERMISSIONS.create],
} satisfies Record<string, PermissionCode[]>;

export type EstimateRoutes = Record<string, (params: unknown) => unknown>;

/** GET theo URL; handler ném `ApiError` để giả lập lỗi. Trả spy để test kiểm số lần / tham số gọi. */
export function mockEstimateGet(permissions: readonly PermissionCode[], routes: EstimateRoutes) {
  return vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
      }
      const handler = routes[url];
      if (!handler) throw new ApiError(404, "NOT_FOUND", `Không có mock cho GET ${url}`);
      return { data: handler(config?.params) };
    });
}

export async function renderWithEstimateProviders(ui: React.ReactElement) {
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });
  await act(async () => {
    render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
  return client;
}
