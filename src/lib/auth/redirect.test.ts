import { describe, expect, it } from "vitest";

import { homeFor, landingFor, loginUrlFor, safeCallbackUrl } from "./redirect";

describe("auth redirect — area routing (staff /admin vs customer /portal)", () => {
  it("accepts internal /admin and /portal callbacks incl. query (filters survive re-login)", () => {
    expect(safeCallbackUrl("/admin/quotes?status=SENT&page=2")).toBe(
      "/admin/quotes?status=SENT&page=2",
    );
    expect(safeCallbackUrl("/portal/quotes/q1")).toBe("/portal/quotes/q1");
    expect(safeCallbackUrl("/admin")).toBe("/admin");
  });

  it("rejects open redirects, other areas and the public activation page", () => {
    for (const bad of [
      "https://evil.example.com",
      "//evil.example.com/admin",
      "/\evil.example.com",
      "/administrator",
      "/portalx",
      "/login",
      "/portal/activate",
      null,
      undefined,
    ]) {
      expect(safeCallbackUrl(bad)).toBeNull();
    }
  });

  it("customer-only accounts land in /portal, staff in /admin", () => {
    expect(homeFor(["CUSTOMER"])).toBe("/portal");
    expect(homeFor(["SALES_STAFF"])).toBe("/admin");
    // A staff login linked to a customer profile is still staff (BE QuoteService.portalCustomer).
    expect(homeFor(["CUSTOMER", "SALES_STAFF"])).toBe("/admin");
    expect(homeFor([])).toBe("/admin");
  });

  it("keeps a callback only when it belongs to the account's own area", () => {
    expect(landingFor(["SALES_STAFF"], "/admin/customers/c1")).toBe("/admin/customers/c1");
    expect(landingFor(["CUSTOMER"], "/admin/customers/c1")).toBe("/portal");
    expect(landingFor(["CUSTOMER"], "/portal/samples/s1")).toBe("/portal/samples/s1");
    expect(landingFor(["QC_STAFF"], "/portal/quotes")).toBe("/admin");
  });

  it("builds an encoded login URL for the current page", () => {
    expect(loginUrlFor("/admin/production-orders?status=QC")).toBe(
      "/login?callbackUrl=%2Fadmin%2Fproduction-orders%3Fstatus%3DQC",
    );
    expect(loginUrlFor("/")).toBe("/login");
  });
});
