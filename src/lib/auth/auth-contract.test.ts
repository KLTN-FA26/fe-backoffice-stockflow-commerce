import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_PATHS, AUTH_STORAGE_KEY, AUTH_STORAGE_VERSION } from "@/constants/auth";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  completeAuthentication,
  getCurrentUserApi,
  loginApi,
  logoutApi,
  mockLoginApi,
} from "./auth-api";
import { getAuthCookie } from "./auth-cookie";
import { useAuthStore } from "./auth-store";

import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

const tokens = {
  accessToken: "issued-token",
  tokenType: "Bearer" as const,
  expiresInSeconds: 28800,
};
const user = {
  userId: "99331094-506d-4760-97e3-554c627e94f7",
  username: "staff",
  email: "staff@example.com",
  fullName: "Staff",
  status: "ACTIVE",
  roles: ["ROLE_WAREHOUSE_STAFF"],
  lastLoginAt: null,
};
const originalAdapter = api.defaults.adapter;
let requests: InternalAxiosRequestConfig[];
let responseStatus: number;
let meData: unknown;
let observeMe: (() => void) | undefined;
const redirect = vi.fn();

const adapter: AxiosAdapter = async (config) => {
  requests.push(config);
  if (config.url === AUTH_PATHS.me) observeMe?.();
  const data = config.url === AUTH_PATHS.login ? tokens : meData;
  const response = {
    config,
    status: responseStatus,
    statusText: "",
    headers: {},
    data: { success: true, data },
  };
  if (responseStatus >= 400)
    throw new AxiosError("Rejected", undefined, config, undefined, response);
  return response;
};

beforeEach(() => {
  requests = [];
  responseStatus = 200;
  meData = user;
  observeMe = undefined;
  redirect.mockReset();
  useAuthStore.getState().logout();
  localStorage.clear();
  api.defaults.adapter = adapter;
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAuthStore.getState().logout();
});

describe("backend access-token contract", () => {
  it("posts username to identity login and accepts tokens without a refresh token or user", async () => {
    expect(await loginApi({ username: "staff", password: "secret" })).toEqual(tokens);
    expect(requests[0].url).toBe("/identity/auth/login");
    expect(JSON.parse(requests[0].data)).toEqual({ username: "staff", password: "secret" });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("fetches /me with the new bearer before marking authentication complete", async () => {
    observeMe = () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(getAuthCookie()).toBeNull();
      const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "{}");
      expect(stored.state.tokens).toBeNull();
    };
    await completeAuthentication(await loginApi({ username: "staff", password: "secret" }));
    expect(requests.map((request) => request.url)).toEqual([
      "/identity/auth/login",
      "/identity/me",
    ]);
    expect(requests[1].headers.get("Authorization")).toBe("Bearer issued-token");
    expect(useAuthStore.getState()).toMatchObject({ user, tokens, isAuthenticated: true });
    expect(getAuthCookie()).toBe(tokens.accessToken);
  });

  it("accepts nullable profile fields supported by the backend", async () => {
    meData = { ...user, fullName: null, lastLoginAt: null };
    await completeAuthentication(tokens);
    expect(useAuthStore.getState().user?.fullName).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("validates the backend identity schema rather than the obsolete warehouse shape", async () => {
    meData = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles: [],
      warehouseIds: [],
    };
    await expect(getCurrentUserApi()).rejects.toThrow();
  });

  it.each([401, 500])("clears partial login when /me returns %s", async (status) => {
    const issued = await loginApi({ username: "staff", password: "secret" });
    responseStatus = status;
    await expect(completeAuthentication(issued)).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState()).toMatchObject({
      tokens: null,
      user: null,
      isAuthenticated: false,
    });
    expect(getAuthCookie()).toBeNull();
  });

  it("clears partial login when /me has invalid data", async () => {
    meData = {};
    await expect(completeAuthentication(tokens)).rejects.toThrow();
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("does not resurrect a session logged out while /me was pending", async () => {
    observeMe = () => useAuthStore.getState().logout();
    await expect(completeAuthentication(tokens)).rejects.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("401 clears auth and redirects without retrying or requesting refresh", async () => {
    useAuthStore.getState().login(user, tokens);
    vi.stubGlobal("window", { location: { pathname: "/admin/products", replace: redirect } });
    responseStatus = 401;
    await expect(api.get("/protected")).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
    expect(requests.map((request) => request.url)).toEqual(["/protected"]);
    expect(requests.some((request) => request.url === "/auth/refresh")).toBe(false);
  });

  it("rejects concurrent 401s without hanging queued requests", async () => {
    vi.stubGlobal("window", { location: { pathname: "/login", replace: redirect } });
    responseStatus = 401;
    const results = await Promise.allSettled([api.get("/one"), api.get("/two")]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(requests).toHaveLength(2);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps login errors on the form and clears old auth", async () => {
    useAuthStore.getState().login(user, tokens);
    vi.stubGlobal("window", { location: { pathname: "/login", replace: redirect } });
    responseStatus = 401;
    await expect(loginApi({ username: "staff", password: "bad" })).rejects.toMatchObject({
      status: 401,
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(requests[0].headers.get("Authorization")).toBeUndefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it.each([200, 500])(
    "logout sends a bearer with no body and clears auth on status %s",
    async (status) => {
      useAuthStore.getState().login(user, tokens);
      responseStatus = status;
      await expect(logoutApi()).resolves.toBeUndefined();
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe("/identity/auth/logout");
      expect(requests[0].data).toBeUndefined();
      expect(requests[0].headers.get("Authorization")).toBe("Bearer issued-token");
      expect(useAuthStore.getState()).toMatchObject({
        user: null,
        tokens: null,
        isAuthenticated: false,
      });
      expect(getAuthCookie()).toBeNull();
    },
  );

  it("clears local state when logout cannot reach the backend", async () => {
    useAuthStore.getState().login(user, tokens);
    api.defaults.adapter = async (config) => {
      throw new AxiosError("Offline", undefined, config);
    };
    await expect(logoutApi()).resolves.toBeUndefined();
    expect(useAuthStore.getState().tokens).toBeNull();
  });

  it("normalizes other errors without logging out", async () => {
    useAuthStore.getState().login(user, tokens);
    responseStatus = 403;
    await expect(api.get("/protected")).rejects.toMatchObject({ status: 403 });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});

describe("persisted auth", () => {
  it("discards version-0 refresh-token sessions and the stale cookie", async () => {
    useAuthStore.getState().login(user, tokens);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        state: {
          user,
          tokens: { accessToken: "old", refreshToken: "obsolete" },
          isAuthenticated: true,
        },
      }),
    );
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      tokens: null,
      isAuthenticated: false,
    });
    expect(getAuthCookie()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toContain("refreshToken");
  });

  it.each([null, {}, { tokens: tokens, user: {}, isAuthenticated: true }])(
    "rejects malformed current-version state: %j",
    async (state) => {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ version: AUTH_STORAGE_VERSION, state }),
      );
      await useAuthStore.persist.rehydrate();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().tokens).toBeNull();
    },
  );

  it("handles malformed JSON without retaining authentication", async () => {
    useAuthStore.getState().login(user, tokens);
    localStorage.setItem(AUTH_STORAGE_KEY, "{broken");
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(getAuthCookie()).toBeNull();
  });

  it("restores valid current-version state without refresh tokens", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        version: AUTH_STORAGE_VERSION,
        state: { user, tokens, isAuthenticated: true },
      }),
    );
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()).toMatchObject({ user, tokens, isAuthenticated: true });
  });
});

describe("mock contract", () => {
  it("uses the same login and /me DTOs, and logout revokes the mock session", async () => {
    const { activateMockAdapter } = await import("@/lib/api/mock-adapter");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    activateMockAdapter();
    const { getMockLoginUsersApi } = await import("./auth-api");
    const users = await getMockLoginUsersApi();
    const issued = await mockLoginApi(users[0].userId);
    expect(Object.keys(issued).sort()).toEqual(["accessToken", "expiresInSeconds", "tokenType"]);
    await completeAuthentication(issued);
    expect(useAuthStore.getState().user?.userId).toBe(users[0].userId);
    expect(useAuthStore.getState().user).not.toHaveProperty("warehouseIds");
    await logoutApi();
    useAuthStore.getState().establishTokens(issued);
    await expect(getCurrentUserApi()).rejects.toMatchObject({ status: 401 });
  });
});
