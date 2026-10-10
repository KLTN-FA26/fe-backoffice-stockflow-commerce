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
  it("login allow-list is exactly the four Spring codes", () => {
    expect([...LOGIN_ERROR_CODES]).toEqual([
      "UNAUTHORIZED",
      "ACCOUNT_NOT_ACTIVE",
      "ACCOUNT_TEMPORARILY_LOCKED",
      "RATE_LIMITED",
    ]);
  });
});
