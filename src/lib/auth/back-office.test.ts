import { describe, expect, it } from "vitest";

import { BACKOFFICE_ROLES } from "@/constants/permissions";

import { isBackOfficeActor } from "./back-office";

describe("isBackOfficeActor — gương BE ScopeGuards#requireBackOffice", () => {
  it("mọi vai trò BE trừ CUSTOMER là back-office", () => {
    for (const role of BACKOFFICE_ROLES) expect(isBackOfficeActor({ roles: [role] })).toBe(true);
    expect(BACKOFFICE_ROLES).not.toContain("CUSTOMER");
  });

  it("chỉ CUSTOMER, không vai trò, hay chưa tải → không phải back-office", () => {
    expect(isBackOfficeActor({ roles: ["CUSTOMER"] })).toBe(false);
    expect(isBackOfficeActor({ roles: [] })).toBe(false);
    expect(isBackOfficeActor(undefined)).toBe(false);
  });

  it("CUSTOMER kèm vai trò back-office → back-office (BE: anyMatch role ≠ CUSTOMER)", () => {
    expect(isBackOfficeActor({ roles: ["CUSTOMER", "ACCOUNTANT"] })).toBe(true);
  });

  it("vai trò tự tạo / tên hiển thị không phải mã BE đã biết → không tính (BE CurrentUser.roles chỉ có vai trò biết tên)", () => {
    expect(isBackOfficeActor({ roles: ["CUSTOMER", "VIP_CUSTOMER_CARE"] })).toBe(false);
    expect(isBackOfficeActor({ roles: ["System Admin"] })).toBe(false);
    expect(isBackOfficeActor({ roles: ["ROLE_SYSTEM_ADMIN"] })).toBe(false);
  });
});
