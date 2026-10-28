import { describe, expect, it } from "vitest";

import { PORTAL_CUSTOMER_ROLE } from "@/constants/permissions";

import { isBackOfficeActor } from "./back-office";

const CUSTOM_ROLE = "CUSTOM_SUPPORT_CUSTOM";

describe("isBackOfficeActor — UI của BE ScopeGuards#isBackOffice (không phải tài khoản cửa hàng)", () => {
  it.each([
    [[PORTAL_CUSTOMER_ROLE], false],
    [["ORDER_COORDINATOR"], true],
    [["ACCOUNTANT"], true],
    // Vai trò tự tạo (SCRUM-455): /me/permissions trả nguyên mã, BE coi là nhân viên
    [[CUSTOM_ROLE], true],
    // Fail closed: BE không cho CUSTOMER đi cùng vai trò khác (ROLE_NOT_ASSIGNABLE)
    [[PORTAL_CUSTOMER_ROLE, CUSTOM_ROLE], false],
    [[PORTAL_CUSTOMER_ROLE, "ACCOUNTANT"], false],
    // Fail closed: không vai trò
    [[], false],
  ])("roles %j → %s", (roles, expected) => {
    expect(isBackOfficeActor({ roles })).toBe(expected);
  });

  it("chưa tải quyền (undefined) → không phải back-office", () => {
    expect(isBackOfficeActor(undefined)).toBe(false);
  });
});
