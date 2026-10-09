/**
 * Axios HTTP client — single instance for the entire app.
 *
 * Interceptors:
 *  - Request: attach JWT token (Authorization: Bearer) + warehouse header.
 *  - Response: normalise errors into ApiError. On 401 → local logout and redirect.
 *
 * When USE_MOCK=true the mock adapter (mock-adapter.ts) replaces
 * the default adapter so every call resolves against mock-data — component
 * code stays identical.
 *
 * Base URL is always same-origin "/api" — the real backend URL (API_URL) is
 * server-only and never inlined into the client bundle. next.config.ts
 * rewrites "/api/:path*" to the real backend on the server side.
 */

import axios from "axios";

import { APP_ROUTES } from "@/constants";
import { AUTH_PATHS } from "@/constants/auth";

import { useAuthStore } from "@/lib/auth/auth-store";
import { useAppStore } from "@/lib/store/use-app-store";

import { ApiError } from "./error";

import type { AxiosError } from "axios";
import type { ApiErrorBody } from "./error";

export const api = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

/* ── Request interceptor ─────────────────────────────────────────────── */

api.interceptors.request.use((cfg) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken && cfg.url !== AUTH_PATHS.login) {
    cfg.headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  const wh = useAppStore.getState().warehouseId;
  if (wh) cfg.headers.set("X-Warehouse-Id", wh);
  return cfg;
});

/* ── Response interceptor ────────────────────────────────────────────── */

api.interceptors.response.use(
  (res) => {
    const body: unknown = res.data;
    if (
      typeof body === "object" &&
      body !== null &&
      "success" in body &&
      body.success === true &&
      "data" in body
    ) {
      return { ...res, data: body.data };
    }
    return res;
  },
  (err: AxiosError<ApiErrorBody>) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      // Failed login stays on the form so it can display the normalized error.
      if (
        err.config?.url !== AUTH_PATHS.login &&
        typeof window !== "undefined" &&
        window.location.pathname !== APP_ROUTES.login
      ) {
        window.location.replace(APP_ROUTES.login);
      }
    }
    return Promise.reject(ApiError.from(err));
  },
);
