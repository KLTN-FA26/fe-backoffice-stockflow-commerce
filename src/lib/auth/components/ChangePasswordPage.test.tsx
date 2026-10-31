import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANGE_PASSWORD_ERROR_MESSAGES, CHANGE_PASSWORD_UI } from "@/constants/auth";

import { ApiError } from "@/lib/api/error";

import { changePasswordApi, logoutApi } from "../auth-api";
import { useAuthStore } from "../auth-store";
import { ChangePasswordPage } from "./ChangePasswordPage";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/components/shared/Toast", () => ({ toast: { success: vi.fn() } }));
vi.mock("../auth-api", () => ({
  changePasswordApi: vi.fn(),
  logoutApi: vi.fn(),
  getCurrentUserApi: vi.fn(),
}));
const lifecycle = vi.hoisted(() => ({ bootstrapError: null as string | null }));
vi.mock("../use-auth-lifecycle", () => ({
  useAuthLifecycle: () => ({
    status: useAuthStore.getState().status,
    isAuthenticated: useAuthStore.getState().isAuthenticated,
    bootstrapError: lifecycle.bootstrapError,
    retry: vi.fn(),
  }),
}));

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
const CURRENT = "Temp0raryPass";
const NEXT = "Brand-new-Pass1";

beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.bootstrapError = null;
  // Radix Checkbox measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.getState().logout(false);
});

async function fill(actor: ReturnType<typeof userEvent.setup>, next = NEXT, confirm = next) {
  await actor.type(screen.getByLabelText(/Mật khẩu hiện tại/), CURRENT);
  await actor.type(screen.getByLabelText(/^Mật khẩu mới/), next);
  await actor.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), confirm);
}
const submitButton = () => screen.getByRole("button", { name: CHANGE_PASSWORD_UI.submit });

describe("self-service change-password page (SCRUM-474 FIRST-LOGIN)", () => {
  it("forced: explains why, offers no 'sign out other devices' tick, always asks the BE to end the others", async () => {
    useAuthStore.getState().login({ ...user, mustChangePassword: true }, false);
    vi.mocked(changePasswordApi).mockResolvedValue({ revokedSessions: 2 });
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    expect(screen.getByRole("heading", { name: CHANGE_PASSWORD_UI.forcedTitle })).toBeVisible();
    expect(screen.queryByLabelText(CHANGE_PASSWORD_UI.logoutOthersLabel)).not.toBeInTheDocument();
    await fill(actor);
    await actor.click(submitButton());

    await waitFor(() =>
      expect(changePasswordApi).toHaveBeenCalledWith({
        currentPassword: CURRENT,
        newPassword: NEXT,
        logoutOtherDevices: true,
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });
  it("voluntary: the tick is the user's choice and defaults to off", async () => {
    useAuthStore.getState().login(user, false);
    vi.mocked(changePasswordApi).mockResolvedValue({ revokedSessions: 0 });
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    expect(screen.getByRole("heading", { name: CHANGE_PASSWORD_UI.title })).toBeVisible();
    expect(screen.getByRole("link", { name: CHANGE_PASSWORD_UI.back })).toHaveAttribute(
      "href",
      "/admin",
    );
    await fill(actor);
    await actor.click(submitButton());
    await waitFor(() =>
      expect(changePasswordApi).toHaveBeenCalledWith(
        expect.objectContaining({ logoutOtherDevices: false }),
      ),
    );

    cleanup();
    vi.mocked(changePasswordApi).mockClear();
    render(<ChangePasswordPage />);
    await fill(actor);
    await actor.click(screen.getByRole("checkbox"));
    await actor.click(submitButton());
    await waitFor(() =>
      expect(changePasswordApi).toHaveBeenCalledWith(
        expect.objectContaining({ logoutOtherDevices: true }),
      ),
    );
  });
  it("validates before any request: policy, confirmation and 'same as current'", async () => {
    useAuthStore.getState().login(user, false);
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    await fill(actor, "short");
    await actor.click(submitButton());
    expect(await screen.findAllByText(CHANGE_PASSWORD_UI.newRequired)).not.toHaveLength(0);

    cleanup();
    render(<ChangePasswordPage />);
    await fill(actor, NEXT, "Another-Pass-2");
    await actor.click(submitButton());
    expect(await screen.findByText(CHANGE_PASSWORD_UI.confirmMismatch)).toBeVisible();

    cleanup();
    render(<ChangePasswordPage />);
    await fill(actor, CURRENT);
    await actor.click(submitButton());
    expect(await screen.findByText(CHANGE_PASSWORD_UI.sameAsCurrent)).toBeVisible();

    expect(changePasswordApi).not.toHaveBeenCalled();
  });
  it("a wrong current password marks that field, not the whole form", async () => {
    useAuthStore.getState().login({ ...user, mustChangePassword: true }, false);
    vi.mocked(changePasswordApi).mockRejectedValue(
      new ApiError(400, "INVALID_CURRENT_PASSWORD", "x"),
    );
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    await fill(actor);
    await actor.click(submitButton());

    expect(
      await screen.findByText(CHANGE_PASSWORD_ERROR_MESSAGES.INVALID_CURRENT_PASSWORD),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
  it("another failure shows its own copy in an alert and keeps the form", async () => {
    useAuthStore.getState().login(user, false);
    vi.mocked(changePasswordApi).mockRejectedValue(new ApiError(429, "RATE_LIMITED", "x"));
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    await fill(actor);
    await actor.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      CHANGE_PASSWORD_ERROR_MESSAGES.RATE_LIMITED,
    );
    expect(replace).not.toHaveBeenCalled();
  });
  it("forced: the only other way out is signing out", async () => {
    useAuthStore.getState().login({ ...user, mustChangePassword: true }, false);
    vi.mocked(logoutApi).mockResolvedValue();
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    await actor.click(screen.getByRole("button", { name: CHANGE_PASSWORD_UI.logout }));

    await waitFor(() => expect(logoutApi).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("when the session cannot be verified, offers 'Thử lại' and 'Đăng xuất'", async () => {
    lifecycle.bootstrapError = "Không thể xác minh phiên đăng nhập.";
    vi.mocked(logoutApi).mockResolvedValue();
    const actor = userEvent.setup();
    render(<ChangePasswordPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể xác minh phiên đăng nhập.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
    await actor.click(screen.getByRole("button", { name: CHANGE_PASSWORD_UI.logout }));

    await waitFor(() => expect(logoutApi).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
