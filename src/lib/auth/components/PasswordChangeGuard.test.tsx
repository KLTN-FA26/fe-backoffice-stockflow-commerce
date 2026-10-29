import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../auth-store";
import { PasswordChangeGuard } from "./PasswordChangeGuard";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const user = {
  userId: "staff",
  username: "staff",
  email: "staff@example.com",
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
  mustChangePassword: false,
};
const mount = () =>
  render(
    <PasswordChangeGuard>
      <div>Admin shell</div>
    </PasswordChangeGuard>,
  );

beforeEach(() => replace.mockReset());
afterEach(() => {
  cleanup();
  useAuthStore.getState().logout(false);
});

describe("PasswordChangeGuard (SCRUM-474 FIRST-LOGIN)", () => {
  it("renders the admin area for an account with its own password", () => {
    useAuthStore.getState().login(user, false);
    mount();
    expect(screen.getByText("Admin shell")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
  it("sends an account with an administrator-set password to /change-password and renders nothing", () => {
    useAuthStore.getState().login({ ...user, mustChangePassword: true }, false);
    mount();
    expect(screen.queryByText("Admin shell")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/change-password");
  });
  it("reacts when the server later answers PASSWORD_CHANGE_REQUIRED", () => {
    useAuthStore.getState().login(user, false);
    mount();
    expect(replace).not.toHaveBeenCalled();
    act(() => useAuthStore.getState().requirePasswordChange());
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true);
    expect(replace).toHaveBeenCalledWith("/change-password");
  });
});
