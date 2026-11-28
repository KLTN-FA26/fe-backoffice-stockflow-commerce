import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { SidebarProvider } from "@/components/ui/sidebar";

import { SidebarFooterBar } from "./SidebarFooterBar";

const { push, replace, refresh, setPreference } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  setPreference: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh }) }));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "light", preference: "system", setPreference, toggleTheme: vi.fn() }),
}));

function renderFooter() {
  render(
    <SidebarProvider>
      <SidebarFooterBar />
    </SidebarProvider>,
  );
}

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

describe("account menu", () => {
  it("shows the role by its Vietnamese name, not the BE enum", async () => {
    const actor = userEvent.setup();
    renderFooter();

    await actor.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));

    expect(screen.getByRole("term")).toHaveTextContent("Vai trò");
    const role = screen.getByRole("definition");
    expect(role).toHaveTextContent("Nhân viên kho");
    expect(role).not.toHaveTextContent("WAREHOUSE_STAFF");
  });

  it("picks system / light / dark from a three-way theme switch", async () => {
    const actor = userEvent.setup();
    renderFooter();

    await actor.click(screen.getByRole("button", { name: "Tuỳ chọn tài khoản" }));
    const group = screen.getByRole("radiogroup", { name: "Giao diện" });
    expect(screen.getByRole("radio", { name: "Theo hệ thống" })).toBeChecked();

    await actor.click(screen.getByRole("radio", { name: "Tối" }));
    expect(setPreference).toHaveBeenCalledWith("dark");

    screen.getByRole("radio", { name: "Theo hệ thống" }).focus();
    await actor.keyboard("{ArrowRight}");
    expect(setPreference).toHaveBeenLastCalledWith("light");
    expect(group).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const actor = userEvent.setup();
    renderFooter();

    await actor.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));
    await actor.keyboard("{Escape}");

    expect(screen.queryByRole("radiogroup", { name: "Giao diện" })).not.toBeInTheDocument();
  });
});
