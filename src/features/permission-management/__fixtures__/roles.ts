import type { RoleResponse } from "../types";

/** Vai trò theo hợp đồng BE `RoleResponse` (PR #72/#73); mỗi test ghi đè đúng trường nó quan tâm. */
export function roleFixture(overrides: Partial<RoleResponse> = {}): RoleResponse {
  return {
    code: "ROLE_A",
    name: "Role A",
    description: null,
    system: true,
    version: 0,
    holderCount: 0,
    dataScope: "ALL",
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: null,
    lastModifiedAt: null,
    lastModifiedBy: null,
    ...overrides,
  };
}

/** Vai trò tuỳ chỉnh: được đổi tên / xoá khi chưa ai giữ. */
export const customRole = (overrides: Partial<RoleResponse> = {}) =>
  roleFixture({ code: "SHIFT_LEAD", name: "Tổ trưởng ca", system: false, ...overrides });
