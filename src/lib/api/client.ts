/** Same-origin BFF client: credentials are transported exclusively by Next.js. */

import axios from "axios";

import { APP_ROUTES } from "@/constants";
import {
  AUTH_PATHS,
  BROWSER_API_BASE,
  BROWSER_API_TIMEOUT_MS,
  PASSWORD_CHANGE_REQUIRED_CODE,
} from "@/constants/auth";

import { useAuthStore } from "@/lib/auth/auth-store";
import { useAppStore } from "@/lib/store/use-app-store";

import { ApiError } from "./error";

import type { AxiosError } from "axios";
import type { ApiErrorBody } from "./error";

export const api = axios.create({
  baseURL: BROWSER_API_BASE,
  timeout: BROWSER_API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

/* ── Request interceptor ─────────────────────────────────────────────── */

api.interceptors.request.use((cfg) => {
  cfg.headers.delete("Authorization");
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
    if (err.response?.status === 401 && err.config?.url !== AUTH_PATHS.me) {
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
    // SCRUM-474 FIRST-LOGIN: the account still has an administrator-set password, so the BE refuses
    // everything but changing it. Remember that and go to the page that does (the session stays).
    if (
      err.response?.status === 403 &&
      (err.response.data?.errorCode ?? err.response.data?.code) === PASSWORD_CHANGE_REQUIRED_CODE
    ) {
      useAuthStore.getState().requirePasswordChange();
      if (typeof window !== "undefined" && window.location.pathname !== APP_ROUTES.changePassword) {
        window.location.replace(APP_ROUTES.changePassword);
      }
    }
    return Promise.reject(ApiError.from(err));
  },
);
