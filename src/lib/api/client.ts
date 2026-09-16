/**
 * Axios HTTP client — single instance for the entire app.
 *
 * Interceptors:
 *  - Request: attach JWT token (Authorization: Bearer) + warehouse header.
 *  - Response: normalise errors into ApiError. On 401 → try refresh → logout.
 *
 * When USE_MOCK=true the mock adapter (mock-adapter.ts) replaces
 * the default adapter so every call resolves against mock-data — component
 * code stays identical.
 *
 * Base URL is always same-origin "/api" — the real backend URL (API_URL) is
 * server-only and never inlined into the client bundle. next.config.ts
 * rewrites "/api/:path*" to the real backend on the server side.
 */

import axios, { type AxiosError } from "axios";
import { ApiError, type ApiErrorBody } from "./error";

export const api = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

/* ── Request interceptor ─────────────────────────────────────────────── */

api.interceptors.request.use((cfg) => {
  try {
    // Auth token — require() to avoid circular dependency at module init
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/lib/auth/auth-store");
    const tokens = useAuthStore.getState().tokens;
    if (tokens?.accessToken) {
      cfg.headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    }

    // Warehouse header
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppStore } = require("@/lib/store/use-app-store");
    const wh = useAppStore.getState().warehouseId;
    if (wh) cfg.headers.set("X-Warehouse-Id", wh);
  } catch {
    // Store not initialised yet (SSR / test) — skip.
  }
  return cfg;
});

/* ── Response interceptor ────────────────────────────────────────────── */

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiErrorBody>) => {
    const originalRequest = err.config;

    // 401 → try refresh token (skip if already refreshing or if it's the refresh call itself)
    if (
      err.response?.status === 401 &&
      originalRequest &&
      !originalRequest.url?.includes("/auth/") &&
      !(originalRequest as unknown as Record<string, unknown>)._retry
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve) => {
          refreshSubscribers.push((token: string) => {
            originalRequest.headers.set("Authorization", `Bearer ${token}`);
            resolve(api(originalRequest));
          });
        });
      }

      (originalRequest as unknown as Record<string, unknown>)._retry = true;
      isRefreshing = true;

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAuthStore } = require("@/lib/auth/auth-store");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { refreshTokenApi } = require("@/lib/auth/auth-api");
        const refreshToken = useAuthStore.getState().tokens?.refreshToken;

        if (!refreshToken) throw new Error("No refresh token");

        const newTokens = await refreshTokenApi(refreshToken);
        useAuthStore.getState().updateTokens(newTokens);

        onTokenRefreshed(newTokens.accessToken);
        isRefreshing = false;

        originalRequest.headers.set("Authorization", `Bearer ${newTokens.accessToken}`);
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];

        // Refresh failed → logout
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { useAuthStore } = require("@/lib/auth/auth-store");
          useAuthStore.getState().logout();
        } catch {
          /* noop */
        }

        // Redirect to login (client-side only, external navigation)
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }

        return Promise.reject(ApiError.from(err));
      }
    }

    return Promise.reject(ApiError.from(err));
  },
);
