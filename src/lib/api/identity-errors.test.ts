import { describe, expect, it } from "vitest";

import { IDENTITY_ERROR_MESSAGES } from "@/constants";

import { ApiError } from "./error";
import {
  identityErrorMessage,
  identityFieldErrors,
  isIdentityErrorCode,
  isStaleError,
} from "./identity-errors";

/** Mã lỗi BE của quản lý người dùng / vai trò (BE ErrorCode, PR #72/#73) — thêm mã mới vào đây khi BE thêm. */
const BE_CODES = [
  "PRIVILEGE_ESCALATION",
  "OWN_ACCOUNT_NOT_MANAGEABLE",
  "ACCOUNT_TEMPORARILY_LOCKED",
  "USERNAME_ALREADY_EXISTS",
  "USER_EMAIL_ALREADY_EXISTS",
  "ROLE_CODE_ALREADY_EXISTS",
  "ROLE_IN_USE",
  "SYSTEM_ROLE_IMMUTABLE",
  "LAST_SYSTEM_ADMIN",
  "ROLE_NOT_ASSIGNABLE",
  "INVALID_USER_STATUS_TRANSITION",
  "STAFF_ACCOUNT_REQUIRED",
  "OPTIMISTIC_LOCK",
  "ROLE_NOT_FOUND",
  "USER_NOT_FOUND",
  "WAREHOUSE_NOT_FOUND",
  "OUT_OF_DATA_SCOPE",
  "UNSUPPORTED_PARAMETER",
  "UNKNOWN_PERMISSION",
  "ROLE_NOT_EDITABLE",
  "ROLE_PERMISSIONS_CHANGED",
  "RBAC_LOCKOUT",
  "VALIDATION_FAILED",
] as const;

const err = (status: number, code: string, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "English message from the backend", fieldErrors);

describe("identityErrorMessage", () => {
  it.each(BE_CODES)("maps %s to a Vietnamese message, never the backend's English text", (code) => {
    expect(isIdentityErrorCode(code)).toBe(true);
    const message = identityErrorMessage(err(409, code));
    expect(message).toBe(IDENTITY_ERROR_MESSAGES[code]);
    expect(message).not.toMatch(/backend|English/);
    expect(message).toMatch(/[àáạảãâăđêôơưỳýỷỹ]/i);
  });

  it("explains the escalation guard and last-admin protection specifically", () => {
    expect(identityErrorMessage(err(403, "PRIVILEGE_ESCALATION"))).toContain("không có");
    expect(identityErrorMessage(err(409, "LAST_SYSTEM_ADMIN"))).toContain(
      "ít nhất một quản trị viên",
    );
    expect(identityErrorMessage(err(403, "OWN_ACCOUNT_NOT_MANAGEABLE"))).toContain("chính mình");
  });

  it("names the invalid fields of a 400 without echoing the backend's text", () => {
    const message = identityErrorMessage(
      err(400, "VALIDATION_FAILED", { username: "must match", password: "weak" }),
    );
    expect(message).toContain("Tên đăng nhập");
    expect(message).toContain("Mật khẩu");
    expect(message).not.toContain("must match");
  });

  it("falls back to a generic 403 for unknown forbidden codes", () => {
    expect(identityErrorMessage(err(403, "SOMETHING_NEW"))).toBe(IDENTITY_ERROR_MESSAGES.FORBIDDEN);
  });

  it("handles network failures and non-ApiError values", () => {
    expect(identityErrorMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(
      IDENTITY_ERROR_MESSAGES.network,
    );
    expect(identityErrorMessage(new Error("boom"))).toBe(IDENTITY_ERROR_MESSAGES.generic);
    expect(identityErrorMessage(err(500, "INTERNAL"))).toBe(IDENTITY_ERROR_MESSAGES.generic);
  });

  it("does not treat prototype keys as error codes", () => {
    expect(isIdentityErrorCode("toString")).toBe(false);
    expect(isIdentityErrorCode("generic")).toBe(false);
  });
});

describe("identityFieldErrors", () => {
  it("puts duplicate username / email / role code on their own field", () => {
    expect(identityFieldErrors(err(409, "USERNAME_ALREADY_EXISTS"))).toEqual([
      { field: "username", message: IDENTITY_ERROR_MESSAGES.USERNAME_ALREADY_EXISTS },
    ]);
    expect(identityFieldErrors(err(409, "USER_EMAIL_ALREADY_EXISTS"))[0]?.field).toBe("email");
    expect(identityFieldErrors(err(409, "ROLE_CODE_ALREADY_EXISTS"))[0]?.field).toBe("code");
  });

  it("turns server field errors into Vietnamese per-field messages", () => {
    expect(
      identityFieldErrors(err(400, "VALIDATION_FAILED", { email: "must be a well-formed email" })),
    ).toEqual([{ field: "email", message: "Email chưa hợp lệ." }]);
  });

  it("returns nothing for errors without a field", () => {
    expect(identityFieldErrors(err(403, "PRIVILEGE_ESCALATION"))).toEqual([]);
    expect(identityFieldErrors("nope")).toEqual([]);
  });
});

describe("isStaleError", () => {
  it("flags optimistic-lock style conflicts only", () => {
    expect(isStaleError(err(409, "OPTIMISTIC_LOCK"))).toBe(true);
    expect(isStaleError(err(409, "ROLE_PERMISSIONS_CHANGED"))).toBe(true);
    expect(isStaleError(err(409, "ROLE_IN_USE"))).toBe(false);
  });
});
