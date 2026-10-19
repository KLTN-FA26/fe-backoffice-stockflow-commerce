import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";

export function dashboardEndpoint(path: string) {
  return new URL(`${api.defaults.baseURL ?? ""}${path}`, window.location.origin).href;
}

// GET /identity/me/permissions: what a tile shows depends only on these codes.
export function dashboardPermissions(permissions: readonly PermissionCode[]) {
  return http.get(dashboardEndpoint("/identity/me/permissions"), () =>
    HttpResponse.json({
      success: true,
      data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" },
    }),
  );
}

export function signInDashboardActor() {
  useAuthStore.setState({
    user: {
      userId: crypto.randomUUID(),
      fullName: "Test actor",
      email: "actor@example.test",
      roles: ["Warehouse Manager"],
      username: "actor",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

export function renderDashboard(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export function countPage(totalElements: number) {
  return HttpResponse.json({
    success: true,
    data: {
      items: [],
      page: 0,
      size: 1,
      totalElements,
      totalPages: totalElements,
      hasNext: false,
      hasPrevious: false,
    },
  });
}
