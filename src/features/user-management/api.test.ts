import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  assignRole,
  assignWarehouses,
  changeUserStatus,
  createUser,
  getUser,
  listUsers,
  resetPassword,
  revokeRole,
  updateUser,
  listUserStatusChanges,
} from "./api";
import { userFixture, userPage } from "./__fixtures__/users";

afterEach(() => vi.restoreAllMocks());

describe("user management API", () => {
  it("lists with zero-based page, trimmed search, status, role and sort", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: userPage() });
    const page = await listUsers({
      page: 2,
      size: 10,
      q: "  lan ",
      status: "LOCKED",
      role: "ROLE_A",
      sort: "username,desc",
    });
    const [url, config] = get.mock.calls[0] ?? [];
    expect(url).toBe("/identity/users");
    expect(String((config as { params: URLSearchParams }).params)).toBe(
      "page=2&size=10&q=lan&status=LOCKED&role=ROLE_A&sort=username%2Cdesc",
    );
    expect(page.items).toHaveLength(1);
  });

  it("omits empty filters", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: userPage([]) });
    await listUsers({ q: " ", sort: " " });
    expect(String((get.mock.calls[0]?.[1] as { params: URLSearchParams }).params)).toBe(
      "page=0&size=25",
    );
  });

  it("rejects a response that breaks the contract", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { items: [{ userId: "x" }] } });
    await expect(listUsers({})).rejects.toThrow();
  });

  it("gets one user by encoded id", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: userFixture() });
    await getUser("a/b");
    expect(get.mock.calls[0]?.[0]).toBe("/identity/users/a%2Fb");
  });

  it("creates with the BE body shape and returns the one-time password", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { user: userFixture(), temporaryPassword: "Tmp1234567x" } });
    const created = await createUser({
      username: "lan.nguyen",
      email: "lan@x.vn",
      fullName: "",
      password: "",
      roles: ["ROLE_A"],
      warehouseIds: ["WH-HN"],
    });
    expect(post).toHaveBeenCalledWith("/identity/users", {
      username: "lan.nguyen",
      email: "lan@x.vn",
      roles: ["ROLE_A"],
      warehouseIds: ["WH-HN"],
    });
    expect(created.temporaryPassword).toBe("Tmp1234567x");
  });

  it("patches email, full name and the loaded version", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: userFixture({ version: 5 }) });
    await updateUser({ userId: "u1", values: { email: "n@x.vn", fullName: "Lan" }, version: 4 });
    expect(patch).toHaveBeenCalledWith("/identity/users/u1", {
      email: "n@x.vn",
      fullName: "Lan",
      version: 4,
    });
  });

  it("PUTs the complete warehouse set", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: userFixture() });
    await assignWarehouses("u1", ["A", "B"]);
    expect(put).toHaveBeenCalledWith("/identity/users/u1/warehouses", { warehouseIds: ["A", "B"] });
    await assignWarehouses("u1", []);
    expect(put).toHaveBeenLastCalledWith("/identity/users/u1/warehouses", { warehouseIds: [] });
  });

  it.each(["lock", "unlock", "disable", "enable"] as const)(
    "POSTs %s with the trimmed reason (SCRUM-474 LOCK-REASON)",
    async (action) => {
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: userFixture() });
      await changeUserStatus({ userId: "u1", action, reason: "  Nghi ngờ lộ mật khẩu  " });
      expect(post).toHaveBeenCalledWith(`/identity/users/u1/${action}`, {
        reason: "Nghi ngờ lộ mật khẩu",
      });
    },
  );

  it.each(["", "    ", "abcd", " abcd ", "x".repeat(501)])(
    "never sends a reason the BE would refuse (%j)",
    async (reason) => {
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: userFixture() });
      await expect(changeUserStatus({ userId: "u1", action: "lock", reason })).rejects.toThrow();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("counts code points and trims Unicode spaces like the BE", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: userFixture() });
    // 5 emoji = 10 UTF-16 units but 5 characters; 500 of them are still allowed
    await changeUserStatus({ userId: "u1", action: "lock", reason: "\u{1F512}".repeat(500) });
    await changeUserStatus({ userId: "u1", action: "lock", reason: "\u00a0 abcde \u3000" });
    expect(post).toHaveBeenLastCalledWith("/identity/users/u1/lock", { reason: "abcde" });
    await expect(
      changeUserStatus({ userId: "u1", action: "lock", reason: "\u00a0".repeat(6) }),
    ).rejects.toThrow();
    await expect(
      changeUserStatus({ userId: "u1", action: "lock", reason: "\u{1F512}".repeat(501) }),
    ).rejects.toThrow();
  });

  it("accepts exactly 5 and exactly 500 characters", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: userFixture() });
    await changeUserStatus({ userId: "u1", action: "lock", reason: "abcde" });
    await changeUserStatus({ userId: "u1", action: "lock", reason: "x".repeat(500) });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("reads the status history, newest first, as a page", async () => {
    const entry = {
      id: "c1",
      action: "LOCK",
      fromStatus: "ACTIVE",
      toStatus: "LOCKED",
      reason: "Nghi ngờ lộ mật khẩu",
      actorId: "a1",
      actorUsername: "admin",
      changedAt: "2026-10-29T03:00:00Z",
    };
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [entry],
        page: 1,
        size: 10,
        totalElements: 11,
        totalPages: 2,
        hasNext: false,
        hasPrevious: true,
      },
    });
    const page = await listUserStatusChanges("u1", { page: 1 });
    expect(get).toHaveBeenCalledWith("/identity/users/u1/status-changes", {
      params: new URLSearchParams({ page: "1", size: "10" }),
      signal: undefined,
    });
    expect(page.items).toEqual([entry]);
  });

  it("resets the password with an optional new password", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { temporaryPassword: "Tmp1234567x", sessionsEnded: 3 } });
    expect(await resetPassword({ userId: "u1" })).toEqual({
      temporaryPassword: "Tmp1234567x",
      sessionsEnded: 3,
    });
    expect(post).toHaveBeenLastCalledWith("/identity/users/u1/password-reset", {});
    await resetPassword({ userId: "u1", newPassword: "Abcdefghi1" });
    expect(post).toHaveBeenLastCalledWith("/identity/users/u1/password-reset", {
      newPassword: "Abcdefghi1",
    });
  });

  it("assigns and revokes a role", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    await assignRole("u1", "ROLE_A");
    expect(post).toHaveBeenCalledWith("/identity/users/u1/roles", { roleCode: "ROLE_A" });
    await revokeRole("u1", "ROLE_A");
    expect(del).toHaveBeenCalledWith("/identity/users/u1/roles/ROLE_A");
  });
});
