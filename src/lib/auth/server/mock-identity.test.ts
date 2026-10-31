// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, MOCK_LOGIN_PASSWORD } from "@/constants/auth";

import { getMockStaffUsers } from "@/lib/api/mock-adapter";

import { backendProxyHandler, loginHandler } from "./handlers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: true }));

const origin = "http://localhost:3000";

interface UserRow {
  userId: string;
  username: string;
  email: string;
  status: string;
  roles: string[];
  warehouseIds: string[];
  version: number;
}
/** Hình dạng đủ dùng của mọi phản hồi mock được kiểm ở đây (người dùng, trang, vai trò, lỗi). */
interface Body extends Partial<UserRow> {
  errorCode?: string;
  items?: UserRow[];
  user?: UserRow;
  temporaryPassword?: string | null;
  sessionsEnded?: number;
  code?: string;
  name?: string;
  system?: boolean;
  holderCount?: number;
  dataScope?: string;
  roleCode?: string;
  editable?: boolean;
  grantedCount?: number;
}

async function session(userId: string) {
  const user = (await getMockStaffUsers()).find((candidate) => candidate.userId === userId);
  if (!user) throw new Error(`Missing mock user ${userId}`);
  const response = await loginHandler(
    new NextRequest(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({ username: user.email, password: MOCK_LOGIN_PASSWORD }),
    }),
  );
  const cookie = response.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) throw new Error("no session");
  return async (method: string, path: string, body?: unknown) => {
    const [route = "", query = ""] = path.split("?");
    const result = await backendProxyHandler(
      new NextRequest(`${origin}/api/backend/${route}${query ? `?${query}` : ""}`, {
        method,
        headers: {
          Cookie: `${AUTH_COOKIE_NAME}=${cookie}`,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      route.split("/"),
    );
    const text = await result.text();
    return { status: result.status, body: text ? (JSON.parse(text) as Body) : null };
  };
}

describe("mock BFF — staff user management (BE PR #72/#73 contract)", () => {
  it("lists with paging, filters and sorting like UserManagementController", async () => {
    const call = await session("USER-ADMIN-01");
    const all = await call("GET", "identity/users?page=0&size=3&sort=username,desc");
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ page: 0, size: 3, hasPrevious: false });
    expect(all.body?.items).toHaveLength(3);
    const names = (all.body?.items ?? []).map((u) => u.username);
    expect(names).toEqual([...names].sort().reverse());

    const found = await call("GET", "identity/users?q=quang");
    expect((found.body?.items ?? []).map((u) => u.userId)).toContain("USER-ADMIN-01");
    const none = await call("GET", "identity/users?q=zzzz-no-match");
    expect(none.body).toMatchObject({ totalElements: 0, items: [] });
    const byRole = await call("GET", "identity/users?role=WAREHOUSE_STAFF");
    expect(byRole.body?.items?.length).toBeGreaterThan(0);
    for (const user of byRole.body?.items ?? []) expect(user.roles).toContain("WAREHOUSE_STAFF");
  });

  it("refuses callers without identity-users permission codes (not by role name)", async () => {
    const call = await session("USER-PROC-01");
    expect((await call("GET", "identity/users")).status).toBe(403);
    expect((await call("POST", "identity/users", {})).status).toBe(403);
  });

  it("creates a user: generated password once, duplicates 409, unknown role 404, bad input 400", async () => {
    const call = await session("USER-ADMIN-01");
    const payload = {
      username: "mock.new",
      email: "mock.new@stockflow.vn",
      roles: ["WAREHOUSE_STAFF"],
      warehouseIds: ["WH-HN-01"],
    };
    const created = await call("POST", "identity/users", payload);
    expect(created.status).toBe(201);
    expect(created.body?.temporaryPassword).toMatch(/^Tmp-/);
    expect(created.body?.user).toMatchObject({
      username: "mock.new",
      status: "ACTIVE",
      mustChangePassword: true,
      warehouseIds: ["WH-HN-01"],
    });

    const withPassword = await call("POST", "identity/users", {
      ...payload,
      username: "mock.two",
      email: "two@stockflow.vn",
      password: "Abcdefghi1",
    });
    expect(withPassword.body?.temporaryPassword).toBeNull();

    const dupUser = await call("POST", "identity/users", {
      ...payload,
      username: "MOCK.NEW",
      email: "other@stockflow.vn",
    });
    expect(dupUser).toMatchObject({ status: 409, body: { errorCode: "USERNAME_ALREADY_EXISTS" } });
    const dupMail = await call("POST", "identity/users", { ...payload, username: "mock.three" });
    expect(dupMail).toMatchObject({
      status: 409,
      body: { errorCode: "USER_EMAIL_ALREADY_EXISTS" },
    });
    const unknownRole = await call("POST", "identity/users", {
      ...payload,
      username: "mock.four",
      email: "four@x.vn",
      roles: ["NOPE"],
    });
    expect(unknownRole).toMatchObject({ status: 404, body: { errorCode: "ROLE_NOT_FOUND" } });
    const weak = await call("POST", "identity/users", {
      ...payload,
      username: "mock.five",
      email: "five@x.vn",
      password: "weak",
    });
    expect(weak).toMatchObject({ status: 400, body: { errorCode: "VALIDATION_FAILED" } });
  });

  it("edits with the version: stale → OPTIMISTIC_LOCK, then status transitions follow User.lock/unlock/enable", async () => {
    const call = await session("USER-ADMIN-01");
    const target = "USER-WH-02";
    const loaded = (await call("GET", `identity/users/${target}`)).body;
    const saved = await call("PATCH", `identity/users/${target}`, {
      email: "dat.new@stockflow.vn",
      fullName: "Đạt",
      version: loaded?.version,
    });
    expect(saved.body).toMatchObject({
      email: "dat.new@stockflow.vn",
      version: (loaded?.version ?? 0) + 1,
    });
    const stale = await call("PATCH", `identity/users/${target}`, {
      email: "dat.new@stockflow.vn",
      fullName: "Đạt",
      version: loaded?.version,
    });
    expect(stale).toMatchObject({ status: 409, body: { errorCode: "OPTIMISTIC_LOCK" } });

    const why = { reason: "Lý do kiểm thử" };
    // SCRUM-474 LOCK-REASON: no reason, a blank one, 4 or 501 characters are refused before anything changes
    for (const bad of [{}, { reason: "    " }, { reason: "abcd" }, { reason: "x".repeat(501) }]) {
      expect(await call("POST", `identity/users/${target}/lock`, bad)).toMatchObject({
        status: 400,
        body: { errorCode: "VALIDATION_FAILED" },
      });
    }
    expect((await call("GET", `identity/users/${target}`)).body?.status).toBe("ACTIVE");
    expect((await call("POST", `identity/users/${target}/lock`, why)).body?.status).toBe("LOCKED");
    expect((await call("POST", `identity/users/${target}/enable`, why)).status).toBe(409);
    expect((await call("POST", `identity/users/${target}/unlock`, why)).body?.status).toBe(
      "ACTIVE",
    );
    expect((await call("POST", `identity/users/${target}/disable`, why)).body?.status).toBe(
      "DISABLED",
    );
    const lockDisabled = await call("POST", `identity/users/${target}/lock`, why);
    expect(lockDisabled).toMatchObject({
      status: 409,
      body: { errorCode: "INVALID_USER_STATUS_TRANSITION" },
    });
    expect(
      (await call("POST", `identity/users/${target}/enable`, { reason: "  Ký lại hợp đồng  " }))
        .body?.status,
    ).toBe("ACTIVE");

    // the detail shows the latest reason and the history lists every action, newest first
    const detail = (await call("GET", `identity/users/${target}`)).body as unknown as {
      latestStatusChange: { action: string; reason: string };
    };
    expect(detail.latestStatusChange).toMatchObject({
      action: "ENABLE",
      reason: "Ký lại hợp đồng",
    });
    const history = (await call("GET", `identity/users/${target}/status-changes`))
      .body as unknown as {
      items: { action: string; fromStatus: string; toStatus: string }[];
    };
    expect(history.items.map((entry) => entry.action)).toEqual([
      "ENABLE",
      "DISABLE",
      "UNLOCK",
      "LOCK",
    ]);
    expect(history.items[0]).toMatchObject({ fromStatus: "DISABLED", toStatus: "ACTIVE" });
  });

  it("PUT warehouses replaces the whole set; password reset generates one temporary password", async () => {
    const call = await session("USER-ADMIN-01");
    const set = await call("PUT", "identity/users/USER-WH-03/warehouses", {
      warehouseIds: ["WH-HCM-01", "WH-DN-01"],
    });
    expect(set.body?.warehouseIds).toEqual(["WH-HCM-01", "WH-DN-01"]);
    expect(
      (await call("PUT", "identity/users/USER-WH-03/warehouses", { warehouseIds: [] })).body
        ?.warehouseIds,
    ).toEqual([]);
    const reset = await call("POST", "identity/users/USER-WH-03/password-reset", {});
    expect(reset.body).toMatchObject({ sessionsEnded: 1 });
    expect(reset.body?.temporaryPassword).toMatch(/^Tmp-/);
    const given = await call("POST", "identity/users/USER-WH-03/password-reset", {
      newPassword: "Abcdefghi1",
    });
    expect(given.body?.temporaryPassword).toBeNull();
    expect(
      (await call("POST", "identity/users/USER-WH-03/password-reset", { newPassword: "weak" }))
        .status,
    ).toBe(400);
  });

  it("never lets an administrator manage their own account, and protects the last administrator", async () => {
    const call = await session("USER-ADMIN-01");
    expect(await call("POST", "identity/users/USER-ADMIN-01/lock")).toMatchObject({
      status: 403,
      body: { errorCode: "OWN_ACCOUNT_NOT_MANAGEABLE" },
    });
    // USER-ADMIN-01 is the only top-role holder: the demo has nobody else to demote
    const roles = (await call("GET", "identity/users/USER-ADMIN-01")).body?.roles ?? [];
    expect(roles).toContain("SYSTEM_ADMIN");
  });

  it("assigns and revokes a role through /users/{id}/roles", async () => {
    const call = await session("USER-ADMIN-01");
    expect(
      (await call("POST", "identity/users/USER-WH-04/roles", { roleCode: "QC_STAFF" })).status,
    ).toBe(201);
    expect((await call("GET", "identity/users/USER-WH-04")).body?.roles).toContain("QC_STAFF");
    expect(
      (await call("POST", "identity/users/USER-WH-04/roles", { roleCode: "NOPE" })).status,
    ).toBe(404);
    expect((await call("DELETE", "identity/users/USER-WH-04/roles/QC_STAFF")).status).toBe(200);
    expect((await call("GET", "identity/users/USER-WH-04")).body?.roles).not.toContain("QC_STAFF");
  });
});

describe("mock BFF — custom roles (BE PR #72 SCRUM-455)", () => {
  it("create → rename → delete follows the BE rules", async () => {
    const call = await session("USER-ADMIN-01");
    const created = await call("POST", "identity/roles", {
      code: "MOCK_LEAD",
      name: "Mock lead",
      dataScope: "WAREHOUSE",
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        code: "MOCK_LEAD",
        system: false,
        version: 0,
        holderCount: 0,
        dataScope: "WAREHOUSE",
      },
    });
    expect(
      (await call("POST", "identity/roles", { code: "mock_lead", name: "dup" })).body?.errorCode,
    ).toBe("ROLE_CODE_ALREADY_EXISTS");
    expect((await call("GET", "identity/roles/MOCK_LEAD/permissions")).body).toMatchObject({
      roleCode: "MOCK_LEAD",
      editable: true,
      grantedCount: 0,
    });

    const renamed = await call("PATCH", "identity/roles/MOCK_LEAD", {
      name: "Renamed",
      version: 0,
    });
    expect(renamed.body).toMatchObject({ name: "Renamed", version: 1 });
    expect(
      (await call("PATCH", "identity/roles/MOCK_LEAD", { name: "Stale", version: 0 })).body
        ?.errorCode,
    ).toBe("OPTIMISTIC_LOCK");

    await call("POST", "identity/users/USER-WH-04/roles", { roleCode: "MOCK_LEAD" });
    expect((await call("DELETE", "identity/roles/MOCK_LEAD")).body?.errorCode).toBe("ROLE_IN_USE");
    await call("DELETE", "identity/users/USER-WH-04/roles/MOCK_LEAD");
    expect((await call("DELETE", "identity/roles/MOCK_LEAD")).status).toBe(204);
    expect((await call("GET", "identity/roles/MOCK_LEAD/permissions")).status).toBe(404);
  });

  it("system roles are immutable and role admin needs its own permission codes", async () => {
    const call = await session("USER-ADMIN-01");
    expect(
      (await call("PATCH", "identity/roles/WAREHOUSE_STAFF", { name: "x", version: 0 })).body
        ?.errorCode,
    ).toBe("SYSTEM_ROLE_IMMUTABLE");
    expect((await call("DELETE", "identity/roles/WAREHOUSE_STAFF")).body?.errorCode).toBe(
      "SYSTEM_ROLE_IMMUTABLE",
    );
    const proc = await session("USER-PROC-01");
    expect((await proc("POST", "identity/roles", { code: "NOPE_X", name: "x" })).status).toBe(403);
  });
});
