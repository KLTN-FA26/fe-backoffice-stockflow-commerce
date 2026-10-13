// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME } from "@/constants/auth";

import { BFF_CLIENT_IP_HEADER, VERCEL_CLIENT_IP_HEADER } from "./client-ip";
import { loginHandler } from "./handlers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: false }));

const origin = "https://backoffice.example.com";
const credential = "server-session-fixture";
const user = {
  userId: "staff",
  username: "staff",
  email: "staff@example.com",
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
};
const fetchMock = vi.fn<typeof fetch>();
const envelope = (data: unknown) => Response.json({ success: true, data });
function login(body: string | undefined, headers: Record<string, string> = {}) {
  return loginHandler(
    new NextRequest(`${origin}/api/auth/login`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=stale; ${LEGACY_AUTH_COOKIE_NAME}=legacy`,
        [VERCEL_CLIENT_IP_HEADER]: "203.0.113.7",
        ...headers,
      },
      body,
    }),
  );
}
const valid = JSON.stringify({ username: "staff", password: "secret" });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://backend.example.com/api/v1");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("VERCEL", "1");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("login request body is classified before any upstream work", () => {
  it.each([
    ["syntax error", '{"username":"staff" "password":"secret"}'],
    ["truncated", '{"username":"admin",'],
    ["empty body", ""],
    ["not JSON", "username=staff&password=secret"],
    ["empty object", "{}"],
    ["empty strings", JSON.stringify({ username: "", password: "" })],
    ["wrong types", JSON.stringify({ username: 123, password: true })],
    ["JSON null", "null"],
  ])("%s → 400 INVALID_CREDENTIALS, no Spring call, no session", async (_name, body) => {
    const response = await login(body);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: "INVALID_CREDENTIALS" });
    // Parser internals never reach the browser.
    expect(text).not.toMatch(/SyntaxError|Unexpected|JSON input|position/);
    // Neither identity/auth/login nor identity/me.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0 });
    expect(response.cookies.get(LEGACY_AUTH_COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0 });
  });
  it.each([
    ["foreign Origin", { Origin: "https://evil.example.com" }],
    ["cross-site fetch", { "Sec-Fetch-Site": "cross-site" }],
  ])("malformed body from %s is a CSRF 403 first", async (_name, headers) => {
    const response = await login('{"username":', headers);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("valid body + Spring unreachable is still 502 AUTH_UPSTREAM_FAILURE", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const response = await login(valid);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "AUTH_UPSTREAM_FAILURE" });
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0 });
  });
  it.each([
    [401, "UNAUTHORIZED"],
    [403, "ACCOUNT_NOT_ACTIVE"],
    [403, "ACCOUNT_TEMPORARILY_LOCKED"],
    [429, "RATE_LIMITED"],
  ])("valid body + Spring %i %s keeps the allow-listed contract", async (status, code) => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: false, errorCode: code, message: "x" }, { status }),
    );
    const response = await login(valid);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  });
  it("valid credentials still reach Spring once, with the trusted client IP", async () => {
    vi.stubEnv("BFF_ORIGIN_SECRET", "test-only-bff-origin-secret-placeholder");
    fetchMock
      .mockResolvedValueOnce(
        envelope({ accessToken: credential, tokenType: "Bearer", expiresInSeconds: 60 }),
      )
      .mockResolvedValueOnce(envelope(user));
    const response = await login(valid);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0].toString()).toContain("/identity/auth/login");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      username: "staff",
      password: "secret",
    });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get(BFF_CLIENT_IP_HEADER)).toBe(
      "203.0.113.7",
    );
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe(credential);
  });
});
