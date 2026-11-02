// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "@/constants/auth";

import { proxy } from "./proxy";

vi.mock("server-only", () => ({}));

const origin = "https://app.example.com";
const get = (path: string, cookie = false) =>
  proxy(
    new NextRequest(origin + path, {
      headers: cookie ? { Cookie: `${AUTH_COOKIE_NAME}=session` } : {},
    }),
  );

describe("proxy — protected areas", () => {
  it("sends anonymous /admin and /portal visits to login with the full return path", () => {
    for (const path of ["/admin/quotes?status=SENT", "/portal/quotes/q1", "/portal"]) {
      const response = get(path);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("callbackUrl")).toBe(path);
    }
  });

  it("keeps the invitation activation page public (customer has no password yet)", () => {
    expect(get("/portal/activate").headers.get("location")).toBeNull();
  });

  it("lets a session through to both areas", () => {
    expect(get("/portal/quotes", true).headers.get("location")).toBeNull();
    expect(get("/admin/customers", true).headers.get("location")).toBeNull();
  });

  it("an authenticated visit to /login follows a safe callback instead of always /admin", () => {
    const back = get(`/login?callbackUrl=${encodeURIComponent("/admin/quotes?status=SENT")}`, true);
    expect(back.headers.get("location")).toBe(`${origin}/admin/quotes?status=SENT`);
    const evil = get(`/login?callbackUrl=${encodeURIComponent("//evil.example.com")}`, true);
    expect(evil.headers.get("location")).toBe(`${origin}/admin`);
  });
});
