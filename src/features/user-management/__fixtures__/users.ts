import type { UserDto } from "../types";

/** Hợp đồng BE `UserResponse` (PR #72/#73); mỗi test ghi đè đúng trường nó quan tâm. */
export function userFixture(overrides: Partial<UserDto> = {}): UserDto {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    username: "lan.nguyen",
    email: "lan.nguyen@stockflow.vn",
    fullName: "Nguyễn Thị Lan",
    status: "ACTIVE",
    roles: ["ROLE_A"],
    warehouseIds: ["WH-HN"],
    mustChangePassword: false,
    lockedUntil: null,
    lastLoginAt: "2026-10-20T03:00:00Z",
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: "flyway",
    version: 4,
    ...overrides,
  };
}

/** `PageResponse<UserResponse>` một trang. */
export function userPage(items: UserDto[] = [userFixture()], extra: Record<string, unknown> = {}) {
  return {
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
    ...extra,
  };
}

/** `GET /identity/roles` thô — đủ trường như BE sau PR #72/#73. */
export const rawRoles = [
  {
    code: "ROLE_A",
    name: "Role A",
    system: true,
    version: 0,
    holderCount: 3,
    dataScope: "ALL",
    createdAt: "2026-09-03T00:00:00Z",
  },
  {
    code: "ROLE_B",
    name: "Role B",
    system: true,
    version: 0,
    holderCount: 1,
    dataScope: "WAREHOUSE",
    createdAt: "2026-09-03T00:00:00Z",
  },
  {
    code: "SHIFT_LEAD",
    name: "Tổ trưởng ca",
    system: false,
    version: 2,
    holderCount: 0,
    dataScope: "ALL",
    createdAt: "2026-10-01T00:00:00Z",
  },
];

/** `GET /warehouses` thô (BE `WarehouseResponse`). */
export const rawWarehouses = {
  items: [
    { id: "WH-HN", prefix: "HN", name: "Kho Hà Nội", status: "ACTIVE" },
    { id: "WH-HCM", prefix: "HCM", name: "Kho TP.HCM", status: "ACTIVE" },
    { id: "WH-OLD", prefix: "OLD", name: "Kho cũ", status: "INACTIVE" },
  ],
  page: 0,
  size: 200,
  totalElements: 3,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};
