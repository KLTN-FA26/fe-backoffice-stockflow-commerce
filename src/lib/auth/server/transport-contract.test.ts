// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, LOGIN_ERROR_CODES } from "@/constants/auth";

import { api } from "@/lib/api/client";

import { backendFetch } from "./backend";
import { backendProxyHandler, loginHandler, meHandler } from "./handlers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: false }));

// Literal wire values on purpose: moving them into constants must not change what is sent.
const MESSAGE = "Không thể hoàn tất yêu cầu.";
const origin = "https://backoffice.example.com";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://backend.example.com/api/v1");
  vi.stubEnv("APP_ORIGIN", "");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("transport timeouts stay at 15 seconds", () => {
  it("BFF → Spring fetch aborts after 15000 ms", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await backendFetch("products", { method: "GET" });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(15_000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("browser → BFF axios times out after 15000 ms", () => {
    expect(api.defaults.timeout).toBe(15_000);
  });
});

// WF-02 BO-3: an explicit list of long-running commands waits 120 s; everything else stays at 15 s.
const LONG = [
  ["POST", "designs/01a1f291-0000-7000-8000-000000000001/reviews"],
  ["POST", "design-review-rounds/0r000000-0000-7000-8000-000000000001/approvals"],
] as const;
const SHORT = [
  ["GET", "designs/01a1f291-0000-7000-8000-000000000001/reviews"],
  ["GET", "designs/review-queue"],
  ["GET", "designs/01a1f291-0000-7000-8000-000000000001"],
  ["POST", "designs/01a1f291-0000-7000-8000-000000000001/submission"],
  ["POST", "design-review-rounds/0r000000-0000-7000-8000-000000000001/approvals/extra"],
  ["POST", "quotes/q-1/sending"],
  ["PUT", "design-review-rounds/0r000000-0000-7000-8000-000000000001/approvals"],
] as const;

describe("long-running routes wait 120 seconds, every other route 15 seconds", () => {
  it.each(LONG)("BFF %s %s → 120000 ms", async (method, path) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await backendFetch(path, { method });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(120_000);
  });
  it.each(SHORT)("BFF %s %s → 15000 ms", async (method, path) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await backendFetch(path, { method });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(15_000);
  });

  const sentTimeout = async (method: string, path: string) => {
    let timeout: number | undefined;
    await api.request({
      method,
      url: `/${path}`,
      adapter: async (config) => {
        timeout = config.timeout;
        return { data: null, status: 204, statusText: "", headers: {}, config };
      },
    });
    return timeout;
  };
  it.each(LONG)("axios %s /%s → 120000 ms", async (method, path) => {
    expect(await sentTimeout(method, path)).toBe(120_000);
  });
  it.each(SHORT)("axios %s /%s → 15000 ms", async (method, path) => {
    expect(await sentTimeout(method, path)).toBe(15_000);
  });
});

describe("BFF error envelope and codes are unchanged", () => {
  it("cross-origin login: 403 CSRF_REJECTED with the generic transport message", async () => {
    const response = await loginHandler(
      new NextRequest(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { Origin: "https://evil.example.com" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "CSRF_REJECTED", message: MESSAGE });
  });
  it("invalid login body: 400 INVALID_CREDENTIALS", async () => {
    const response = await loginHandler(
      new NextRequest(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { Origin: origin },
        body: "{",
      }),
    );
    expect(await response.json()).toEqual({ code: "INVALID_CREDENTIALS", message: MESSAGE });
  });
  it("unknown Spring login failure: LOGIN_FAILED; Spring down: AUTH_UPSTREAM_FAILURE", async () => {
    const login = () =>
      loginHandler(
        new NextRequest(`${origin}/api/auth/login`, {
          method: "POST",
          headers: { Origin: origin },
          body: JSON.stringify({ username: "staff", password: "secret" }),
        }),
      );
    fetchMock.mockResolvedValueOnce(Response.json({ errorCode: "SOMETHING" }, { status: 500 }));
    expect(await (await login()).json()).toEqual({ code: "LOGIN_FAILED", message: MESSAGE });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await (await login()).json()).toEqual({
      code: "AUTH_UPSTREAM_FAILURE",
      message: MESSAGE,
    });
  });
  it("no session: 401 UNAUTHENTICATED", async () => {
    const response = await meHandler(new NextRequest(`${origin}/api/auth/me`));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHENTICATED", message: MESSAGE });
  });
  it("proxy rejections keep INVALID_BACKEND_PATH and 413 PAYLOAD_TOO_LARGE", async () => {
    const headers = { Origin: origin, Cookie: `${AUTH_COOKIE_NAME}=session` };
    const badPath = await backendProxyHandler(
      new NextRequest(`${origin}/api/backend/x`, { headers }),
      [".."],
    );
    expect(await badPath.json()).toEqual({ code: "INVALID_BACKEND_PATH", message: MESSAGE });
    const tooLarge = await backendProxyHandler(
      new NextRequest(`${origin}/api/backend/purchase-orders`, {
        method: "POST",
        headers,
        body: new Uint8Array(1024 * 1024 + 1),
      }),
      ["purchase-orders"],
    );
    expect(tooLarge.status).toBe(413);
    expect(await tooLarge.json()).toEqual({ code: "PAYLOAD_TOO_LARGE", message: MESSAGE });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("login allow-list is exactly the five Spring codes", () => {
    expect([...LOGIN_ERROR_CODES]).toEqual([
      "UNAUTHORIZED",
      "ACCOUNT_NOT_ACTIVE",
      "ACCOUNT_TEMPORARILY_LOCKED",
      "TEMPORARY_PASSWORD_EXPIRED", // SCRUM-474 FIRST-LOGIN: 72 h expiry of an administrator-set password
      "RATE_LIMITED",
    ]);
  });
});
