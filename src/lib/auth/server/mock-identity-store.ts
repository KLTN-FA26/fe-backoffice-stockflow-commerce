import "server-only";

import { getMockStaffUsers } from "@/lib/api/mock-adapter";
import { toBackendRoles } from "@/lib/api/mock-backend-roles";

import { mockRoles } from "./mock-role-matrices";

import type { MockRole } from "./mock-role-matrices";

/** Tài khoản của mock BE — cùng hình dạng `UserResponse` (BE PR #72/#73). */
export interface MockUser {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  roles: string[];
  warehouseIds: string[];
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
  version: number;
}

// Route bundles của Next dùng chung state trong cùng tiến trình server, không phải state trình duyệt.
const runtime = globalThis as typeof globalThis & {
  stockflowMockIdentityRoles?: MockRole[];
  stockflowMockIdentityUsers?: Promise<MockUser[]>;
};

export const roleStore = (): MockRole[] =>
  (runtime.stockflowMockIdentityRoles ??= mockRoles.map((role) => ({ ...role })));

/** Người dùng demo lấy từ danh sách nhân viên mock (một lần), rồi sống trong bộ nhớ tiến trình. */
export function userStore(): Promise<MockUser[]> {
  runtime.stockflowMockIdentityUsers ??= getMockStaffUsers().then((staff) =>
    staff.map((member) => ({
      userId: member.userId,
      username: member.email.split("@")[0] ?? member.email,
      email: member.email,
      fullName: member.fullName,
      status: member.active ? "ACTIVE" : "DISABLED",
      roles: toBackendRoles(member.roles),
      warehouseIds: [...member.warehouseIds],
      mustChangePassword: false,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: "2026-09-03T00:00:00Z",
      createdBy: "flyway",
      version: 0,
    })),
  );
  return runtime.stockflowMockIdentityUsers;
}

/** Tài khoản có giữ vai trò `code` không. */
export const holdsRole = (user: MockUser, code: string): boolean => new Set(user.roles).has(code);

/** Số tài khoản đang giữ vai trò (`RoleResponse.holderCount`). */
export async function holderCount(roleCode: string): Promise<number> {
  return (await userStore()).filter((user) => holdsRole(user, roleCode)).length;
}
