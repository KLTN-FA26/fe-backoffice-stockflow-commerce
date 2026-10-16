// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, MOCK_LOGIN_PASSWORD } from "@/constants/auth";
import {
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  ORDER_PERMISSIONS,
  PERMISSION_QUERY,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
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
  // Seed BE: V20260903000100 (sales-orders APPROVE chỉ ORDER_COORDINATOR), V20261013000200
  // (sales-order-cancellations:UPDATE cho SALES_STAFF + ORDER_COORDINATOR), V20261013000400
  // (sales-order-credit-holds APPROVE chỉ ACCOUNTANT; Sales/Coordinator chỉ VIEW_PAGE/READ).
  it("order / cancellation / credit-hold grants match the BE seed exactly, per role", () => {
    const orderScope = (userId: string) =>
      mockSessionPermissions(userId, []).permissions.filter((code) =>
        code.startsWith("sales-order"),
      );
    const ORDER = ORDER_PERMISSIONS;
    const CREDIT = CREDIT_HOLD_PERMISSIONS;
    const sales = [ORDER.viewPage, ORDER.read, ORDER.cancel, CREDIT.viewPage, CREDIT.read];
    const coordinator = [...sales, ORDER.release];
    const accountant = [CREDIT.viewPage, CREDIT.read, CREDIT.approve];

    for (const id of ["USER-SALE-01", "USER-SALE-02", "USER-SALE-03"]) {
      expect(orderScope(id)).toEqual([...sales].sort());
    }
    expect(orderScope("USER-COORD-01")).toEqual([...coordinator].sort());
    expect(orderScope("USER-ACC-01")).toEqual([...accountant].sort());
    expect(orderScope("USER-ADMIN-01")).toEqual([...coordinator, CREDIT.approve].sort());

    // Vắng mặt quan trọng: không role nào được nới quyền do merge
    expect(orderScope("USER-ACC-01")).not.toContain(ORDER.viewPage);
    expect(orderScope("USER-ACC-01")).not.toContain(ORDER.read);
    expect(orderScope("USER-COORD-01")).not.toContain(CREDIT.approve);
    expect(orderScope("USER-SALE-01")).not.toContain(ORDER.release);
    expect(orderScope("USER-SALE-01")).not.toContain(CREDIT.approve);
    // Quyền không thuộc đơn bán của develop vẫn giữ (kho xuất của Coordinator, NCC của Accountant)
    expect(mockSessionPermissions("USER-COORD-01", []).permissions).toContain(
      FULFILLMENT_PICK_PERMISSIONS.update,
    );
    expect(mockSessionPermissions("USER-ACC-01", []).permissions).toContain(
      SUPPLIER_PERMISSIONS.read,
    );
  });
  it("customer-credit-profiles:READ theo seed BE V20261013000400 — chỉ vai trò được cấp", () => {
    const read = CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read;
    for (const id of ["USER-ACC-01", "USER-SALE-01", "USER-COORD-01", "USER-ADMIN-01"]) {
      expect(mockSessionPermissions(id, []).permissions).toContain(read);
    }
    for (const id of ["USER-WH-01", "USER-QC-01", "USER-PROC-01", "USER-ECAD-01", "USER-PLAN-01"]) {
      expect(mockSessionPermissions(id, []).permissions).not.toContain(read);
    }
  });

  it("USER-COORD-01 giữ đủ quyền đơn bán / công nợ (PR #27) VÀ chuyển kho / chuyến xe (PR #28)", () => {
    const coord = mockSessionPermissions("USER-COORD-01", []).permissions;
    // Đơn bán + công nợ (chỉ xem công nợ, release được, huỷ được, đọc hồ sơ công nợ)
    for (const code of [
      ORDER_PERMISSIONS.viewPage,
      ORDER_PERMISSIONS.read,
      ORDER_PERMISSIONS.release,
      ORDER_PERMISSIONS.cancel,
      CREDIT_HOLD_PERMISSIONS.viewPage,
      CREDIT_HOLD_PERMISSIONS.read,
      CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    ]) {
      expect(coord).toContain(code);
    }
    // Chuyển kho (phần WAREHOUSE_STAFF) + chuyến xe
    for (const code of [
      TRANSFER_PERMISSIONS.viewPage,
      TRANSFER_PERMISSIONS.read,
      TRANSFER_PERMISSIONS.update,
      ...Object.values(SHIPMENT_PERMISSIONS),
    ]) {
      expect(coord).toContain(code);
    }
    // Không nới: duyệt công nợ chỉ ACCOUNTANT; duyệt / tạo chuyển kho không phải phần Coordinator
    expect(coord).not.toContain(CREDIT_HOLD_PERMISSIONS.approve);
    expect(coord).not.toContain(TRANSFER_PERMISSIONS.approve);
    expect(coord).not.toContain(TRANSFER_PERMISSIONS.create);
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
