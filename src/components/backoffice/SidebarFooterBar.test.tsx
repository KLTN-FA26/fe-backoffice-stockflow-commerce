import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { SidebarProvider } from "@/components/ui/sidebar";

import { SidebarFooterBar } from "./SidebarFooterBar";

const { push, replace, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh }) }));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  useAuthStore.getState().login(
    {
      userId: "staff",
      username: "staff",
      email: "staff@example.com",
      fullName: "Nhân viên kho",
      status: "ACTIVE",
      roles: ["WAREHOUSE_STAFF"],
      lastLoginAt: null,
      mustChangePassword: false,
    },
    false,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.getState().logout(false);
});

describe("user menu (SCRUM-474 FIRST-LOGIN: self-service password change for every staff user)", () => {
  it("has a 'Đổi mật khẩu' entry that opens the change-password page", async () => {
    const actor = userEvent.setup();
    render(
      <SidebarProvider>
        <SidebarFooterBar />
      </SidebarProvider>,
    );

    await actor.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));
    await actor.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    expect(push).toHaveBeenCalledWith("/change-password");
  });
});
