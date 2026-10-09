import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_STORAGE_KEY, AUTH_STORAGE_VERSION } from "@/constants/auth";

import { api } from "@/lib/api/client";

import { getAuthCookie, setAuthCookie } from "../auth-cookie";
import { useAuthStore } from "../auth-store";

import { AuthGuard } from "./AuthGuard";

const { replace, cookieAtRedirect } = vi.hoisted(() => ({
  replace: vi.fn(),
  cookieAtRedirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (path: string) => {
      cookieAtRedirect(document.cookie);
      replace(path);
    },
  }),
}));

const tokens = {
  accessToken: "guard-token",
  tokenType: "Bearer" as const,
  expiresInSeconds: 28800,
};
const user = {
  userId: "guard-user",
  username: "staff",
  email: "staff@example.com",
  fullName: "Staff",
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
};
const persisted = () => ({
  version: AUTH_STORAGE_VERSION,
  state: { user, tokens, isAuthenticated: true },
});
const originalStorage = useAuthStore.persist.getOptions().storage;
const originalAdapter = api.defaults.adapter;

function renderGuard() {
  return render(
    <AuthGuard>
      <div>Protected admin</div>
    </AuthGuard>,
  );
}
function storageEvent(key: string | null, storageArea = localStorage) {
  act(() => window.dispatchEvent(new StorageEvent("storage", { key, storageArea })));
}

beforeEach(async () => {
  useAuthStore.persist.setOptions({ storage: originalStorage });
  useAuthStore.getState().logout();
  localStorage.clear();
  await useAuthStore.persist.rehydrate();
  replace.mockReset();
  cookieAtRedirect.mockReset();
});
afterEach(() => {
  cleanup();
  useAuthStore.persist.setOptions({ storage: originalStorage });
  api.defaults.adapter = originalAdapter;
  useAuthStore.getState().logout();
  vi.restoreAllMocks();
});

describe("admin auth lifecycle", () => {
  it("does not server-render protected UI even when client state is authenticated", () => {
    useAuthStore.getState().login(user, tokens);
    const html = renderToString(
      <AuthGuard>
        <div>Protected admin</div>
      </AuthGuard>,
    );
    expect(html).not.toContain("Protected admin");
    expect(html).toContain('role="status"');
  });

  it("repairs malformed cookie encoding from valid local auth", () => {
    useAuthStore.getState().login(user, tokens);
    document.cookie = "stockflow-auth-token=%E0%A4%A; path=/";
    renderGuard();
    expect(getAuthCookie()).toBe(tokens.accessToken);
    expect(screen.getByText("Protected admin")).toBeInTheDocument();
  });

  it("malformed cross-tab persistence replaces stale authenticated memory", async () => {
    useAuthStore.getState().login(user, tokens);
    renderGuard();
    localStorage.setItem(AUTH_STORAGE_KEY, "{broken");
    storageEvent(AUTH_STORAGE_KEY);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(useAuthStore.getState().user).toBeNull();
    expect(getAuthCookie()).toBeNull();
  });

  it("waits for delayed F5 hydration without rendering admin or redirecting", async () => {
    let finish: ((value: ReturnType<typeof persisted>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof persisted>>((resolve) => {
      finish = resolve;
    });
    useAuthStore.persist.setOptions({
      storage: {
        getItem: () => pending,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    setAuthCookie(tokens.accessToken);
    void useAuthStore.persist.rehydrate();
    renderGuard();
    expect(screen.queryByText("Protected admin")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(getAuthCookie()).toBe(tokens.accessToken);
    await act(async () => {
      finish?.(persisted());
      await pending;
    });
    expect(await screen.findByText("Protected admin")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([null, "stale-token"])(
    "restores authenticated local state and repairs cookie %s",
    async (cookie) => {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(persisted()));
      if (cookie) setAuthCookie(cookie);
      await useAuthStore.persist.rehydrate();
      renderGuard();
      expect(screen.getByText("Protected admin")).toBeInTheDocument();
      expect(getAuthCookie()).toBe(tokens.accessToken);
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("removes an orphan cookie before navigating to login, breaking the proxy loop", () => {
    setAuthCookie("orphan");
    renderGuard();
    expect(screen.queryByText("Protected admin")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
    expect(cookieAtRedirect).toHaveBeenCalledWith("");
    expect(getAuthCookie()).toBeNull();
  });

  it.each([
    "{broken",
    JSON.stringify({ version: AUTH_STORAGE_VERSION, state: { isAuthenticated: true, tokens } }),
  ])("malformed persistence cannot authenticate: %s", async (raw) => {
    localStorage.setItem(AUTH_STORAGE_KEY, raw);
    setAuthCookie("orphan");
    await useAuthStore.persist.rehydrate();
    renderGuard();
    expect(screen.queryByText("Protected admin")).not.toBeInTheDocument();
    expect(getAuthCookie()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it.each(["remove", "clear", "signed-out"])(
    "reconciles stale memory when another tab performs %s",
    async (operation) => {
      useAuthStore.getState().login(user, tokens);
      renderGuard();
      expect(screen.getByText("Protected admin")).toBeInTheDocument();
      if (operation === "clear") localStorage.clear();
      else if (operation === "remove") localStorage.removeItem(AUTH_STORAGE_KEY);
      else
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            version: AUTH_STORAGE_VERSION,
            state: { user: null, tokens: null, isAuthenticated: false },
          }),
        );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      storageEvent(operation === "clear" ? null : AUTH_STORAGE_KEY);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
      expect(useAuthStore.getState().tokens).toBeNull();
      expect(getAuthCookie()).toBeNull();
      expect(screen.queryByText("Protected admin")).not.toBeInTheDocument();
    },
  );

  it("reconciles cross-tab account/token changes from persistence", async () => {
    useAuthStore.getState().login(user, tokens);
    renderGuard();
    const changed = {
      ...persisted(),
      state: {
        ...persisted().state,
        user: { ...user, userId: "other-user" },
        tokens: { ...tokens, accessToken: "other-token" },
      },
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(changed));
    storageEvent(AUTH_STORAGE_KEY);
    await waitFor(() => expect(useAuthStore.getState().user?.userId).toBe("other-user"));
    expect(getAuthCookie()).toBe("other-token");
    expect(screen.getByText("Protected admin")).toBeInTheDocument();
  });

  it("ignores unrelated keys and sessionStorage events", () => {
    useAuthStore.getState().login(user, tokens);
    renderGuard();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    storageEvent("unrelated-preference");
    storageEvent(AUTH_STORAGE_KEY, sessionStorage);
    expect(screen.getByText("Protected admin")).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("reconciles same-tab storage removal when the window regains focus", async () => {
    useAuthStore.getState().login(user, tokens);
    renderGuard();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(getAuthCookie()).toBeNull();
  });

  it("existing API 401 removes the cookie and protected UI", async () => {
    useAuthStore.getState().login(user, tokens);
    renderGuard();
    api.defaults.adapter = async (config) => {
      throw new AxiosError("revoked", undefined, config, undefined, {
        config,
        status: 401,
        statusText: "",
        headers: {},
        data: { message: "revoked" },
      });
    };
    await act(async () => {
      await expect(api.get("/protected")).rejects.toMatchObject({ status: 401 });
    });
    expect(getAuthCookie()).toBeNull();
    expect(screen.queryByText("Protected admin")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
