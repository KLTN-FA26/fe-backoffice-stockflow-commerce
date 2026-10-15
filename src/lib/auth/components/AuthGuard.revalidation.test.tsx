import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENT_STORAGE_KEY } from "@/constants/auth";

import { ApiError } from "@/lib/api/error";

import { getCurrentUserApi } from "../auth-api";
import { bootstrapSession } from "../auth-session";
import { useAuthStore } from "../auth-store";
import { meKeys } from "../me-permissions";
import { AuthGuard } from "./AuthGuard";

import type { AuthUser } from "../auth-store";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../auth-api", () => ({ getCurrentUserApi: vi.fn() }));

const userA: AuthUser = {
  userId: "A",
  username: "a",
  email: "a@example.com",
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
};
const userB: AuthUser = { ...userA, userId: "B", username: "b", email: "b@example.com" };
const unauthorized = () => new ApiError(401, "UNAUTHENTICATED", "Signed out");

type Settle = { resolve: (user: AuthUser) => void; reject: (error: unknown) => void };
// Unsettled calls are rejected after each test, so a failing test cannot leave the shared
// in-flight /me hanging and cascade into the next one.
const openCalls = new Set<Settle>();

/** A /me call the test settles explicitly, so assertions can run while it is in flight. */
function pendingMe() {
  let settle: Settle | undefined;
  vi.mocked(getCurrentUserApi).mockImplementationOnce(
    () =>
      new Promise<AuthUser>((resolve, reject) => {
        const call: Settle = {
          resolve: (user) => {
            openCalls.delete(call);
            resolve(user);
          },
          reject: (error) => {
            openCalls.delete(call);
            reject(error);
          },
        };
        settle = call;
        openCalls.add(call);
      }),
  );
  return {
    resolve: (user: AuthUser) => act(async () => settle?.resolve(user)),
    reject: (error: unknown) => act(async () => settle?.reject(error)),
  };
}
function UnsavedForm() {
  const [note, setNote] = useState("");
  return (
    <label>
      Ghi chú
      <input value={note} onChange={(event) => setNote(event.target.value)} />
    </label>
  );
}
async function mountWithUnsavedText() {
  render(
    <AuthGuard>
      <UnsavedForm />
    </AuthGuard>,
  );
  await userEvent.type(screen.getByLabelText("Ghi chú"), "unsaved text");
  return screen.getByLabelText("Ghi chú");
}
const focus = () => act(() => window.dispatchEvent(new Event("focus")));
const crossTab = (event: "logout" | "session-changed") =>
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: AUTH_EVENT_STORAGE_KEY,
        newValue: JSON.stringify({ event, nonce: crypto.randomUUID() }),
      }),
    ),
  );
let statuses: string[] = [];
let unsubscribe = () => {};

beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", undefined);
  localStorage.clear();
  vi.mocked(getCurrentUserApi).mockReset();
  replace.mockReset();
  useAuthStore.getState().login(userA, false);
  statuses = [];
  unsubscribe = useAuthStore.subscribe((state) => statuses.push(state.status));
});
afterEach(async () => {
  unsubscribe();
  cleanup();
  vi.mocked(getCurrentUserApi).mockRejectedValue(unauthorized());
  await act(async () => {
    for (const call of [...openCalls]) call.reject(unauthorized());
  });
  await bootstrapSession();
  await bootstrapSession();
  useAuthStore.getState().logout(false);
  vi.unstubAllGlobals();
});

describe("background revalidation keeps authenticated UI mounted", () => {
  it("focus + pending /me + same user: no unknown state, form and value survive, no churn", async () => {
    const input = await mountWithUnsavedText();
    const version = useAuthStore.getState().authorizationVersion;
    const me = pendingMe();
    await focus();
    expect(useAuthStore.getState()).toMatchObject({
      status: "authenticated",
      isAuthenticated: true,
      user: userA,
    });
    expect(screen.getByLabelText("Ghi chú")).toBe(input);
    expect(input).toHaveValue("unsaved text");
    await me.resolve({ ...userA });
    expect(screen.getByLabelText("Ghi chú")).toBe(input);
    expect(input).toHaveValue("unsaved text");
    expect(statuses).not.toContain("unknown");
    expect(useAuthStore.getState().authorizationVersion).toBe(version);
    // Reconciliation is silent: no cross-tab notification that would make tabs ping-pong.
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
  it.each([
    ["502", new ApiError(502, "AUTH_UPSTREAM_FAILURE", "Unavailable")],
    ["network", new ApiError(0, "NETWORK_ERROR", "Offline")],
    ["403", new ApiError(403, "FORBIDDEN", "Denied")],
  ])("focus + %s keeps user, form and value; no redirect, no error UI", async (_name, error) => {
    const input = await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    await me.reject(error);
    expect(screen.getByLabelText("Ghi chú")).toBe(input);
    expect(input).toHaveValue("unsaved text");
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: userA });
    expect(useAuthStore.getState().bootstrapError).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
  it("focus + 401 is authoritative: logout, protected content removed, redirect", async () => {
    await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    await me.reject(unauthorized());
    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByLabelText("Ghi chú")).not.toBeInTheDocument();
  });
  it("rapid focus events share one in-flight /me", async () => {
    await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    await focus();
    await focus();
    expect(getCurrentUserApi).toHaveBeenCalledTimes(1);
    await me.resolve(userA);
  });
});

describe("identity change and cross-tab events", () => {
  it("different user from a cross-tab change replaces identity and retires A's authorization", async () => {
    await mountWithUnsavedText();
    const before = useAuthStore.getState().authorizationVersion;
    const keyA = meKeys.sessionPermissions("A", before);
    vi.mocked(getCurrentUserApi).mockResolvedValueOnce(userB);
    await crossTab("session-changed");
    await waitFor(() => expect(useAuthStore.getState().user?.userId).toBe("B"));
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.authorizationVersion).toBeGreaterThan(before);
    expect(meKeys.sessionPermissions("B", state.authorizationVersion)).not.toEqual(keyA);
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toBeNull();
  });
  it("signed-out tab ignores focus but discovers another tab's login without reload", async () => {
    act(() => useAuthStore.getState().logout(false));
    render(
      <AuthGuard>
        <UnsavedForm />
      </AuthGuard>,
    );
    await focus();
    expect(getCurrentUserApi).not.toHaveBeenCalled();
    vi.mocked(getCurrentUserApi).mockResolvedValueOnce(userA);
    await crossTab("session-changed");
    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(await screen.findByLabelText("Ghi chú")).toBeInTheDocument();
  });
  it("cross-tab logout supersedes a pending /me: its late 200 cannot resurrect the session", async () => {
    await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    vi.mocked(getCurrentUserApi).mockRejectedValueOnce(unauthorized());
    await crossTab("logout");
    await me.resolve(userA);
    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(getCurrentUserApi).toHaveBeenCalledTimes(2);
  });
  it("local logout during background /me wins over its late 200", async () => {
    await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    act(() => useAuthStore.getState().logout(false));
    await me.resolve(userA);
    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
  });
  it("a new login during a stale background /me is not overwritten by it", async () => {
    await mountWithUnsavedText();
    const me = pendingMe();
    await focus();
    act(() => useAuthStore.getState().login(userB, false));
    await me.resolve(userA);
    expect(useAuthStore.getState().user?.userId).toBe("B");
  });
});

describe("foreground bootstrap is unchanged", () => {
  it("focus during the initial bootstrap joins it instead of starting another", async () => {
    act(() => useAuthStore.getState().beginBootstrap());
    const me = pendingMe();
    render(
      <AuthGuard>
        <UnsavedForm />
      </AuthGuard>,
    );
    expect(screen.queryByLabelText("Ghi chú")).not.toBeInTheDocument();
    await focus();
    expect(getCurrentUserApi).toHaveBeenCalledTimes(1);
    await me.resolve(userA);
    expect(screen.getByLabelText("Ghi chú")).toBeInTheDocument();
  });
  it("retry after a failed initial bootstrap verifies again and renders", async () => {
    act(() => useAuthStore.getState().beginBootstrap());
    vi.mocked(getCurrentUserApi)
      .mockRejectedValueOnce(new ApiError(502, "AUTH_UPSTREAM_FAILURE", "Unavailable"))
      .mockResolvedValueOnce(userA);
    render(
      <AuthGuard>
        <UnsavedForm />
      </AuthGuard>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByLabelText("Ghi chú")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
