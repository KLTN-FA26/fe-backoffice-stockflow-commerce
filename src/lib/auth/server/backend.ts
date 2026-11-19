import "server-only";

import { z } from "zod";

import { BFF_UPSTREAM_TIMEOUT_MS } from "@/constants/auth";

import { IS_MOCK } from "@/lib/config";

export const BACKEND_AUTH_PATHS = {
  login: "identity/auth/login",
  me: "identity/me",
  logout: "identity/auth/logout",
  password: "identity/auth/password",
} as const;
// BE develop identity/internal/controller/dto/AuthTokenResponse.java. Server only.
export const backendTokensSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  expiresInSeconds: z.number().int().positive(),
});

export function backendUrl(path: string, query = ""): URL {
  const base = new URL(
    (process.env.API_URL ?? "http://localhost:8080/api/v1").replace(/\/+$/, "") + "/",
  );
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid backend configuration");
  const target = new URL(base.href + path);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname))
    throw new Error("Invalid backend path");
  target.search = query;
  return target;
}
/**
 * Ngôn ngữ BE dùng cho `message` / `fieldErrors[].message` (BE `I18nConfig`, `AcceptHeaderLocaleResolver`). Back office
 * chỉ có tiếng Việt: BFF luôn gửi `vi`, không theo ngôn ngữ trình duyệt — máy để en-US từng nhận lỗi tiếng Anh
 * (WF-02 audit, lỗi 3).
 */
export const BACKEND_ACCEPT_LANGUAGE = "vi";

export async function backendFetch(path: string, init: RequestInit, query = ""): Promise<Response> {
  if (IS_MOCK) {
    const { mockAuthBackend } = await import("./mock");
    return mockAuthBackend(path, init, query);
  }
  const headers = new Headers(init.headers);
  headers.set("Accept-Language", BACKEND_ACCEPT_LANGUAGE);
  return fetch(backendUrl(path, query), {
    ...init,
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(BFF_UPSTREAM_TIMEOUT_MS),
  });
}
export async function unwrapBackend(response: Response): Promise<unknown> {
  const data: unknown = await response.json();
  if (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    data.success === true &&
    "data" in data
  )
    return data.data;
  return data;
}
