import { describe, expect, it } from "vitest";

import { toSafeNotificationPath } from "./link";

// Exact link BE InventoryAlertMessages builds for a lot alert (kind + warehouse UUID).
const BE_ALERT_LINK =
  "/admin/inventory/alerts?kind=EXPIRED&warehouseId=0e380000-0000-4000-8000-0000000000a1";

describe("toSafeNotificationPath — strict root-relative /admin policy (SCRUM-147)", () => {
  it.each([
    [BE_ALERT_LINK, BE_ALERT_LINK],
    ["/admin/inventory/alerts?kind=REORDER", "/admin/inventory/alerts?kind=REORDER"],
    [
      "/admin/orders/0e380000-0000-4000-8000-000000000201",
      "/admin/orders/0e380000-0000-4000-8000-000000000201",
    ],
    ["/admin", "/admin"],
    ["/admin/orders#line-2", "/admin/orders#line-2"],
  ])("keeps the canonical in-app path %s", (raw, expected) => {
    expect(toSafeNotificationPath(raw)).toBe(expected);
  });

  it.each([
    ["absolute URL", "https://evil.test/admin"],
    ["same-origin absolute URL", "http://localhost:3000/admin/orders"],
    ["scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["protocol-relative", "//evil.test/admin"],
    ["backslash host", "/\\evil.test"],
    ["backslash inside", "/admin\\..\\..\\evil"],
    ["tab bypass (parser strips → //evil)", "/\t/evil.test"],
    ["newline bypass", "/\n/evil.test"],
    ["carriage return", "/admin/\r/x"],
    ["NUL", "/admin/\u0000"],
    ["DEL", "/admin/\u007f"],
    ["space", "/admin/ orders"],
    ["fullwidth solidus look-alike", "/／evil.test"],
    ["non-ASCII", "/admin/đơn-hàng"],
    ["relative path", "admin/orders"],
    ["empty", ""],
    ["dot segments leaving /admin", "/admin/../login"],
    ["encoded slash", "/admin/%2F%2Fevil.test"],
    ["encoded backslash", "/admin/%5Cevil.test"],
    ["encoded dot segment", "/admin/%2e%2e/login"],
    ["outside the back-office", "/login"],
    ["prefix look-alike", "/administrator"],
    ["storefront API", "/api/backend/identity/me"],
    ["oversized", `/admin/${"a".repeat(2100)}`],
  ])("rejects %s", (_, raw) => {
    expect(toSafeNotificationPath(raw)).toBeNull();
  });
});
