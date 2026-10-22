// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "@/constants/auth";

import { portalActivationHandler } from "./portal-activation";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: false }));

const origin = "https://shop.example.com";
const token = "A".repeat(64);
const fetchMock = vi.fn<typeof fetch>();

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/auth/portal-activation`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://backend.example.com/api/v1");
  vi.stubEnv("APP_ORIGIN", "");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public portal activation BFF route (SCRUM-451)", () => {
  it("forwards {token,password} anonymously to Spring and relays {email}", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: true, data: { email: "buyer@example.com" } }),
    );
    const response = await portalActivationHandler(
      request(
        { token, password: "Secret12345" },
        // A session cookie of someone else must NOT be forwarded as Bearer.
        { Cookie: `${AUTH_COOKIE_NAME}=staff-session` },
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { email: "buyer@example.com" } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://backend.example.com/api/v1/customers/portal-activation");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual({ token, password: "Secret12345" });
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("relays Spring's PORTAL_INVITATION_INVALID unchanged (no fake success)", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { success: false, errorCode: "PORTAL_INVITATION_INVALID", message: "invalid" },
        { status: 400 },
      ),
    );
    const response = await portalActivationHandler(request({ token, password: "Secret12345" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: "PORTAL_INVITATION_INVALID" });
  });

  it("rejects cross-origin posts before calling Spring", async () => {
    const response = await portalActivationHandler(
      request({ token, password: "Secret12345" }, { Origin: "https://evil.example.com" }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies and oversized payloads before calling Spring", async () => {
    expect((await portalActivationHandler(request("not-json"))).status).toBe(400);
    expect((await portalActivationHandler(request({ token }))).status).toBe(400);
    expect(
      (await portalActivationHandler(request({ token, password: "x".repeat(8000) }))).status,
    ).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never echoes the invitation token back to the browser", async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true, data: { echo: token } }));
    const response = await portalActivationHandler(request({ token, password: "Secret12345" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(token);
  });
});
