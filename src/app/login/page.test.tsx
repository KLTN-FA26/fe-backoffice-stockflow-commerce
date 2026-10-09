import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { completeAuthentication, loginApi } from "@/lib/auth/auth-api";

import LoginPage from "./page";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams("callbackUrl=/admin/products"),
}));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));
vi.mock("@/components/shared/Logo", () => ({ Logo: () => <span>Logo</span> }));
vi.mock("@/lib/auth/auth-api", () => ({
  completeAuthentication: vi.fn(),
  loginApi: vi.fn(),
  mockLoginApi: vi.fn(),
  getMockLoginUsersApi: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

const tokens = { accessToken: "issued", tokenType: "Bearer" as const, expiresInSeconds: 28800 };

async function submitCredentials() {
  const actor = userEvent.setup();
  render(<LoginPage />);
  await actor.type(screen.getByLabelText("Tên đăng nhập"), "staff.username");
  await actor.type(screen.getByLabelText("Mật khẩu", { exact: true }), "secret");
  await actor.click(screen.getByRole("button", { name: "Đăng nhập vào hệ thống" }));
}

describe("real login form", () => {
  it("submits username and waits for identity bootstrap before callback navigation", async () => {
    vi.mocked(loginApi).mockResolvedValue(tokens);
    let finish: (() => void) | undefined;
    vi.mocked(completeAuthentication).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await submitCredentials();
    await waitFor(() => expect(completeAuthentication).toHaveBeenCalledWith(tokens));
    expect(loginApi).toHaveBeenCalledWith({ username: "staff.username", password: "secret" });
    expect(replace).not.toHaveBeenCalled();
    finish?.();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/products"));
  });

  it("shows /me failure and does not navigate", async () => {
    vi.mocked(loginApi).mockResolvedValue(tokens);
    vi.mocked(completeAuthentication).mockRejectedValue(new Error("Không thể tải tài khoản"));
    await submitCredentials();
    expect(await screen.findByText("Không thể tải tài khoản")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
