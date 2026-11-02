import "server-only";

import type { RoleMatrix } from "@/features/permission-management/types";

const SEED_AT = "2026-09-03T00:00:00Z";
type SeedRole = { code: string; name: string; dataScope?: "OWN" | "WAREHOUSE" | "ALL" };

// Vai trò hệ thống của BE (`app_role.is_system`, PR #72); dataScope theo PR #73. Chỉ là danh mục demo.
const SYSTEM_SEEDS: SeedRole[] = [
  { code: "SYSTEM_ADMIN", name: "System Admin" },
  { code: "ECOMMERCE_ADMIN", name: "E-commerce Admin" },
  { code: "WAREHOUSE_MANAGER", name: "Warehouse Manager", dataScope: "WAREHOUSE" },
  { code: "WAREHOUSE_STAFF", name: "Warehouse Staff", dataScope: "WAREHOUSE" },
  { code: "QC_STAFF", name: "QC Staff", dataScope: "WAREHOUSE" },
  { code: "ORDER_COORDINATOR", name: "Order Coordinator" },
  { code: "INVENTORY_PLANNER", name: "Inventory Planner" },
  { code: "PROCUREMENT_STAFF", name: "Procurement Staff" },
  { code: "SALES_STAFF", name: "Sales Staff" },
  { code: "ACCOUNTANT", name: "Accountant" },
];

/** Vai trò đầu bảng của demo — mock dùng để bảo vệ "phải còn ít nhất một quản trị viên" (BE `LAST_SYSTEM_ADMIN`). */
export const MOCK_TOP_ROLE = "SYSTEM_ADMIN";

export const mockRoles = SYSTEM_SEEDS.map(({ code, name, dataScope }) => ({
  code,
  name,
  description: code === "ECOMMERCE_ADMIN" ? "Catalog and platform administration" : null,
  system: true,
  version: 0,
  holderCount: 0,
  dataScope: dataScope ?? "ALL",
  createdAt: SEED_AT,
  createdBy: code === "ECOMMERCE_ADMIN" ? "flyway" : null,
  lastModifiedAt: code === "WAREHOUSE_MANAGER" ? "2026-09-04T00:00:00Z" : null,
  lastModifiedBy: code === "WAREHOUSE_MANAGER" ? "admin@example.com" : null,
}));
export type MockRole = (typeof mockRoles)[number];

const normalRoleMatrix: RoleMatrix = {
  roleCode: "ECOMMERCE_ADMIN",
  roleLabel: "E-commerce Admin",
  systemRole: true,
  editable: true,
  version: 0,
  dataScope: "ALL",
  grantedCount: 2,
  totalCount: 3,
  groups: [
    {
      name: "Platform",
      grantedCount: 2,
      totalCount: 3,
      resources: [
        {
          code: "identity-rbac",
          label: "Permission matrix",
          route: "/admin/permissions",
          apiPath: "/api/v1/identity/rbac",
          grantedCount: 2,
          totalCount: 3,
          actions: [
            { action: "VIEW_PAGE", label: "Open page", granted: true, sensitive: false },
            { action: "READ", label: "Read data", granted: true, sensitive: false },
            { action: "APPROVE", label: "Approve", granted: false, sensitive: true },
          ],
        },
      ],
    },
  ],
};

/** Ma trận không tick quyền nào, cùng cấu trúc ma trận demo — dùng cho vai trò mới tạo. */
export function emptyMatrixOf(role: {
  code: string;
  name: string;
  dataScope: RoleMatrix["dataScope"];
  system: boolean;
  version?: number;
}): RoleMatrix {
  return {
    ...normalRoleMatrix,
    roleCode: role.code,
    roleLabel: role.name,
    systemRole: role.system,
    version: role.version ?? 0,
    dataScope: role.dataScope,
    grantedCount: 0,
    groups: normalRoleMatrix.groups.map((group) => ({
      ...group,
      grantedCount: 0,
      resources: group.resources.map((resource) => ({
        ...resource,
        grantedCount: 0,
        actions: resource.actions.map((action) => ({ ...action, granted: false })),
      })),
    })),
  };
}

const seededMatrices = Object.fromEntries(
  mockRoles
    .filter((role) => role.code !== "ECOMMERCE_ADMIN")
    .map((role) => [role.code, emptyMatrixOf(role)]),
);

export const initialMockRoleMatrices: Record<string, RoleMatrix> = {
  ...seededMatrices,
  ECOMMERCE_ADMIN: normalRoleMatrix,
  EMPTY_GROUPS: {
    roleCode: "EMPTY_GROUPS",
    roleLabel: "Empty Groups Fixture",
    systemRole: true,
    editable: false,
    version: 0,
    dataScope: "ALL",
    grantedCount: 0,
    totalCount: 0,
    groups: [],
  },
  EMPTY_RESOURCES: {
    roleCode: "EMPTY_RESOURCES",
    roleLabel: "Empty Resources Fixture",
    systemRole: true,
    editable: true,
    version: 0,
    dataScope: "OWN",
    grantedCount: 0,
    totalCount: 0,
    groups: [{ name: "Empty Group", grantedCount: 0, totalCount: 0, resources: [] }],
  },
  EMPTY_ACTIONS: {
    roleCode: "EMPTY_ACTIONS",
    roleLabel: "Empty Actions Fixture",
    systemRole: true,
    editable: true,
    version: 0,
    dataScope: "WAREHOUSE",
    grantedCount: 0,
    totalCount: 0,
    groups: [
      {
        name: "Empty Actions Group",
        grantedCount: 0,
        totalCount: 0,
        resources: [
          {
            code: "empty-resource",
            label: "Empty Resource",
            route: "/admin/empty",
            apiPath: "/api/v1/empty",
            grantedCount: 0,
            totalCount: 0,
            actions: [],
          },
        ],
      },
    ],
  },
};
