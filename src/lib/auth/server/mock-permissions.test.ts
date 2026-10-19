// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, MOCK_LOGIN_PASSWORD } from "@/constants/auth";
import {
  ATTRIBUTE_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  PERMISSION_QUERY,
  PRODUCT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  VARIANT_PERMISSIONS,
} from "@/constants/permissions";

import { getMockStaffUsers } from "@/lib/api/mock-adapter";
import { toBackendRoles } from "@/lib/api/mock-backend-roles";
import { useAuthStore } from "@/lib/auth/auth-store";
import { myPermissionsSchema } from "@/lib/auth/me-permissions";

import { backendProxyHandler, loginHandler } from "./handlers";
import { mockSessionPermissions } from "./mock-permissions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: true }));

describe("explicit mock permission responses", () => {
  it("grants depend only on explicit session fixture, never supplied or impersonated roles", () => {
    expect(mockSessionPermissions("USER-PLAN-01", ["System Admin"]).permissions).toEqual(
      mockSessionPermissions("USER-PLAN-01", []).permissions,
    );
    expect(mockSessionPermissions("USER-PLAN-01", ["System Admin"]).permissions).not.toContain(
      INVENTORY_PERMISSIONS.adjustmentApprove,
    );
    // Fixture "không có quyền": user không có trong bảng grant, kể cả khi giả lập System Admin
    expect(mockSessionPermissions("unknown", ["System Admin"]).permissions).toEqual([]);
    // Planner theo seed BE: không có quyền duyệt dù giả lập System Admin
    const planner = mockSessionPermissions("USER-PLAN-01", ["System Admin"]).permissions;
    expect(planner).toContain(TRANSFER_PERMISSIONS.create);
    expect(planner).not.toContain(TRANSFER_PERMISSIONS.approve);
    expect(mockSessionPermissions("USER-PROC-01", []).permissions).toContain(
      SUPPLIER_PERMISSIONS.create,
    );
  });
  it("admin và E-commerce Admin có product-attributes / product-variants (seed BE V20260928006000); nhân viên kho thì không", () => {
    for (const userId of ["USER-ADMIN-01", "USER-ECAD-01"]) {
      const { permissions } = mockSessionPermissions(userId, []);
      for (const code of [
        ...Object.values(ATTRIBUTE_PERMISSIONS),
        ...Object.values(VARIANT_PERMISSIONS),
      ])
        expect(permissions).toContain(code);
    }
    const warehouse = mockSessionPermissions("USER-WH-01", []).permissions;
    expect(warehouse).not.toContain(ATTRIBUTE_PERMISSIONS.viewPage);
    expect(warehouse).not.toContain(VARIANT_PERMISSIONS.create);
  });
  it("chỉ System Admin có product-lifecycle:APPROVE (BE V20261019000700); E-commerce Admin vẫn duyệt", () => {
    expect(mockSessionPermissions("USER-ADMIN-01", []).permissions).toContain(
      PRODUCT_PERMISSIONS.lifecycle,
    );
    const ecommerce = mockSessionPermissions("USER-ECAD-01", []).permissions;
    expect(ecommerce).not.toContain(PRODUCT_PERMISSIONS.lifecycle);
    expect(ecommerce).toContain(PRODUCT_PERMISSIONS.approve);
    for (const userId of ["USER-WH-01", "USER-PROC-01", "USER-SALE-01", "USER-PLAN-01"])
      expect(mockSessionPermissions(userId, []).permissions).not.toContain(
        PRODUCT_PERMISSIONS.lifecycle,
      );
  });
  it("BFF permissions return the cookie-selected user's validated list despite frontend impersonation", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    const staff = (await getMockStaffUsers()).find(
      (candidate) => candidate.userId === "USER-PLAN-01",
    );
    if (!staff) throw new Error("Missing existing demo staff");
    const origin = "http://localhost:3000";
    const response = await loginHandler(
      new NextRequest(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { Origin: origin },
        body: JSON.stringify({ username: staff.email, password: MOCK_LOGIN_PASSWORD }),
      }),
    );
    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    useAuthStore.getState().setImpersonatedRole("System Admin");
    const permissions = await backendProxyHandler(
      new NextRequest(`${origin}/api/backend${PERMISSION_QUERY.path}`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${cookie?.value}` },
      }),
      ["identity", "me", "permissions"],
    );
    expect(permissions.status).toBe(200);
    expect(myPermissionsSchema.parse(await permissions.json())).toEqual({
      roles: toBackendRoles(staff.roles),
      // Đúng danh sách của phiên (planner), không phải quyền của vai trò đang giả lập
      permissions: mockSessionPermissions("USER-PLAN-01", []).permissions,
      dataScope: "ALL",
    });
    useAuthStore.getState().setImpersonatedRole(null);
    vi.unstubAllEnvs();
  });
  it("production authorization contains no legacy role policy or browser credential regression", () => {
    expect(existsSync("src/lib/auth/permissions.ts")).toBe(false);
    expect(existsSync("src/lib/api/mock-routes-me.ts")).toBe(false);
    for (const path of [
      "src/lib/auth/components/Can.tsx",
      "src/lib/auth/me-permissions.ts",
      "src/features/product/lifecycle.ts",
    ]) {
      expect(readFileSync(path, "utf8")).not.toMatch(
        /effectiveRoles|impersonatedRole|RoleName|ROLE_PERMISSIONS|permissionsFor|accessToken|refreshToken|Authorization.*Bearer/,
      );
    }
  });
});

describe("Inventory grants in the authoritative server session", () => {
  it.each([
    ["System Admin", ["USER-ADMIN-01"], true],
    ["Warehouse Manager", ["USER-ADMIN-01"], true],
    [
      "Warehouse Staff",
      ["USER-WH-01", "USER-WH-02", "USER-WH-03", "USER-WH-04", "USER-COORD-01"],
      false,
    ],
    ["Inventory Planner", ["USER-PLAN-01"], false],
    ["QC Staff", ["USER-QC-01"], false],
  ] as const)("%s receives only its seeded Inventory grants", async (role, ids, approves) => {
    const users = await getMockStaffUsers();
    const codes = Object.values(INVENTORY_PERMISSIONS);
    for (const id of ids) {
      const user = users.find((candidate) => candidate.userId === id);
      if (!user) throw new Error(`Missing mock user ${id}`);
      expect(user.roles).toContain(role);
      const actual = mockSessionPermissions(user.userId, user.roles).permissions.filter((code) =>
        codes.some((inventoryCode) => inventoryCode === code),
      );
      const expected =
        role === "QC Staff"
          ? []
          : codes.filter((code) => approves || code !== INVENTORY_PERMISSIONS.adjustmentApprove);
      expect(actual).toEqual(expected.sort());
    }
  });
});

describe("Inventory item grants (BE PR #119, seed V20260928006000)", () => {
  const ITEM = INVENTORY_ITEM_PERMISSIONS;
  const ALL = Object.values(ITEM);
  const READ = [ITEM.viewPage, ITEM.read];
  it.each([
    // System Admin + Warehouse Manager
    ["USER-ADMIN-01", ALL],
    ["USER-PLAN-01", ALL],
    ["USER-WH-01", READ],
    ["USER-WH-04", READ],
    // Order Coordinator + Warehouse Staff
    ["USER-COORD-01", READ],
    ["USER-PROC-01", READ],
    ["USER-QC-01", []],
    ["USER-ACC-01", []],
    ["USER-ECAD-01", []],
    ["USER-SALE-01", []],
  ] as const)("%s nhận đúng quyền hồ sơ hàng tồn theo seed", (userId, expected) => {
    const codes: readonly string[] = ALL;
    const actual = mockSessionPermissions(userId, []).permissions.filter((code) =>
      codes.includes(code),
    );
    expect(actual).toEqual([...expected].sort());
  });
});
