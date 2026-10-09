import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import AdminLayout from "./layout";

import type { ReactNode } from "react";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/backoffice/BackofficeShell", () => ({
  BackofficeShell: ({ children }: { children: ReactNode }) => <div>Admin shell{children}</div>,
}));
vi.mock("@/lib/auth/components/RoleSwitcher", () => ({
  RoleSwitcher: () => <div>Role toolbar</div>,
}));

beforeEach(async () => {
  useAuthStore.getState().logout();
  localStorage.clear();
  await useAuthStore.persist.rehydrate();
  replace.mockReset();
});
afterEach(() => {
  cleanup();
  useAuthStore.getState().logout();
});

describe("admin layout auth boundary", () => {
  it("keeps the shell, role toolbar, and children behind AuthGuard", () => {
    render(
      <AdminLayout>
        <div>Admin child</div>
      </AdminLayout>,
    );
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
    expect(screen.queryByText("Role toolbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin child")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders the whole admin layout for hydrated client auth", () => {
    useAuthStore.getState().login(
      {
        userId: "layout-user",
        username: "staff",
        fullName: null,
        email: "staff@example.com",
        status: "ACTIVE",
        roles: [],
        lastLoginAt: null,
      },
      { accessToken: "layout-token", tokenType: "Bearer", expiresInSeconds: 28800 },
    );
    render(
      <AdminLayout>
        <div>Admin child</div>
      </AdminLayout>,
    );
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
    expect(screen.getByText("Role toolbar")).toBeInTheDocument();
    expect(screen.getByText("Admin child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
