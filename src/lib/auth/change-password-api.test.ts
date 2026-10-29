import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { api } from "@/lib/api/client";

import { changePasswordApi } from "./auth-api";
import { useAuthStore } from "./auth-store";

const forcedUser = {
  userId: "staff",
  username: "staff",
  email: "staff@example.com",
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
  mustChangePassword: true,
};
const request = {
  currentPassword: "Temp0raryPass",
  newPassword: "Brand-new-Pass1",
  logoutOtherDevices: true,
};

beforeEach(() => useAuthStore.getState().login(forcedUser, false));
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().logout(false);
});

describe("changePasswordApi (SCRUM-474 FIRST-LOGIN)", () => {
  it("reconciles the profile from /me after the change", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: { revokedSessions: 2 } });
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...forcedUser, mustChangePassword: false } });

    expect(await changePasswordApi(request)).toEqual({ revokedSessions: 2 });
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
  });

  it("still reports success, and clears the forced flag, when /me cannot be read afterwards", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: { revokedSessions: 1 } });
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(502, "AUTH_UPSTREAM_FAILURE", "down"));

    expect(await changePasswordApi(request)).toEqual({ revokedSessions: 1 });
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("a failed change leaves the forced flag alone", async () => {
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(400, "INVALID_CURRENT_PASSWORD", "x"));

    await expect(changePasswordApi(request)).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true);
  });
});
