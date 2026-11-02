import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { api } from "./client";
import { ApiError } from "./error";

import type { InternalAxiosRequestConfig } from "axios";

const user = {
  userId: "staff",
  username: "staff",
  email: "staff@example.com",
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
  mustChangePassword: false,
};
const replace = vi.fn();
const original = Object.getOwnPropertyDescriptor(window, "location");

function failWith(status: number, data: unknown) {
  api.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError(
        "failed",
        "ERR_BAD_REQUEST",
        config,
        {},
        {
          status,
          statusText: "",
          headers: {},
          config,
          data,
        },
      ),
    );
}
function at(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname, replace },
  });
}

beforeEach(() => {
  replace.mockReset();
  useAuthStore.getState().login(user, false);
});
afterEach(() => {
  if (original) Object.defineProperty(window, "location", original);
  useAuthStore.getState().logout(false);
});

describe("403 PASSWORD_CHANGE_REQUIRED (SCRUM-474 FIRST-LOGIN)", () => {
  it("marks the account as forced and sends the browser to /change-password, keeping the session", async () => {
    at("/admin/orders");
    failWith(403, { success: false, errorCode: "PASSWORD_CHANGE_REQUIRED" });

    await expect(api.get("/orders")).rejects.toMatchObject({
      status: 403,
      code: "PASSWORD_CHANGE_REQUIRED",
    });

    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(replace).toHaveBeenCalledWith("/change-password");
  });
  it("does not redirect again from the change-password page itself", async () => {
    at("/change-password");
    failWith(403, { success: false, errorCode: "PASSWORD_CHANGE_REQUIRED" });

    await expect(api.get("/orders")).rejects.toBeInstanceOf(ApiError);

    expect(replace).not.toHaveBeenCalled();
  });
  it("any other 403 is left alone", async () => {
    at("/admin/orders");
    failWith(403, { success: false, errorCode: "FORBIDDEN" });

    await expect(api.get("/orders")).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
