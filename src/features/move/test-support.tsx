import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";

// MSW URL of a production request: the shared client's same-origin base path, resolved against jsdom.
export function moveEndpoint(path: string) {
  return new URL(`${api.defaults.baseURL ?? ""}${path}`, window.location.origin).href;
}

// GET /identity/me/permissions: capability comes only from these codes, never from role names.
export function movePermissions(permissions: readonly PermissionCode[]) {
  return http.get(moveEndpoint("/identity/me/permissions"), () =>
    HttpResponse.json({
      success: true,
      data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" },
    }),
  );
}

export function setMoveTestActor() {
  useAuthStore.setState({
    user: {
      userId: crypto.randomUUID(),
      fullName: "Test actor",
      email: "actor@example.test",
      roles: ["Warehouse Staff"],
      username: "actor",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

/** Kho của tab theo kho trong test (spec 2026-11-22) — màn di chuyển chỉ làm việc trong kho này. */
export const MOVE_TAB_WAREHOUSE = {
  id: "11111111-1111-4111-8111-111111111111",
  prefix: "HCM",
  name: "Kho HCM",
};

export function renderMove(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceWarehouseProvider value={MOVE_TAB_WAREHOUSE}>{ui}</WorkspaceWarehouseProvider>
    </QueryClientProvider>,
  );
}

export function failure(status: number, errorCode: string, fieldErrors: unknown[] = []) {
  return HttpResponse.json(
    { success: false, errorCode, message: "English server message", fieldErrors },
    { status },
  );
}
