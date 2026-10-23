import { z } from "zod";

import { permissionCodeSchema } from "@/lib/auth/me-permissions";

export const dataScopeSchema = z.enum(["OWN", "TEAM", "WAREHOUSE", "ALL"]);

export const permissionActionSchema = z.enum([
  "VIEW_PAGE",
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "EXPORT",
]);

// BE `RoleResponse` (PR #72 `system` / `version` / `holderCount`, PR #73 `dataScope`).
export const roleResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  /** Vai trò BE biết theo tên: không đổi tên / xoá được. */
  system: z.boolean(),
  /** Gửi lại khi đổi tên (`PATCH /roles/{code}`). */
  version: z.number().int().nonnegative(),
  /** Số tài khoản đang giữ vai trò — vai trò còn người giữ không xoá được. */
  holderCount: z.number().int().nonnegative(),
  dataScope: dataScopeSchema,
  createdAt: z.string(),
  createdBy: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
  lastModifiedBy: z.string().nullish(),
});

export const roleMatrixActionSchema = z.object({
  action: permissionActionSchema,
  label: z.string(),
  granted: z.boolean(),
  sensitive: z.boolean(),
});

export const roleMatrixResourceSchema = z.object({
  code: z.string(),
  label: z.string(),
  route: z.string(),
  apiPath: z.string(),
  grantedCount: z.number(),
  totalCount: z.number(),
  actions: z.array(roleMatrixActionSchema),
});

export const roleMatrixGroupSchema = z.object({
  name: z.string(),
  grantedCount: z.number(),
  totalCount: z.number(),
  resources: z.array(roleMatrixResourceSchema),
});

export const roleMatrixSchema = z.object({
  roleCode: z.string(),
  roleLabel: z.string(),
  systemRole: z.boolean(),
  editable: z.boolean(),
  version: z.number().int().nonnegative(),
  dataScope: dataScopeSchema,
  grantedCount: z.number(),
  totalCount: z.number(),
  groups: z.array(roleMatrixGroupSchema),
});

export type RoleResponse = z.infer<typeof roleResponseSchema>;
export type RoleMatrixAction = z.infer<typeof roleMatrixActionSchema>;
export type RoleMatrixResource = z.infer<typeof roleMatrixResourceSchema>;
export type RoleMatrixGroup = z.infer<typeof roleMatrixGroupSchema>;
export type RoleMatrix = z.infer<typeof roleMatrixSchema>;

// BE UpdateRolePermissionsRequest: complete visible grants, expected matrix version.
export const updateRolePermissionsSchema = z.object({
  version: z.number().int().nonnegative(),
  permissions: z.array(permissionCodeSchema).max(2000),
});
export type UpdateRolePermissions = z.infer<typeof updateRolePermissionsSchema>;

/* ── Vai trò tuỳ chỉnh (BE PR #72, SCRUM-455/#73) ─────────────────────── */

/** `UpdateRoleRequest.dataScope` / `CreateRoleRequest.dataScope`: BE chỉ nhận OWN / WAREHOUSE / ALL (TEAM chưa có dòng nào để áp). */
export const assignableDataScopeSchema = z.enum(["OWN", "WAREHOUSE", "ALL"]);

// BE `CreateRoleRequest.code`: @Pattern ^[A-Za-z][A-Za-z0-9_]{1,63}$
export const ROLE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

const roleNameSchema = z
  .string()
  .trim()
  .min(1, "Nhập tên vai trò.")
  .max(200, "Tên tối đa 200 ký tự.");
const roleDescriptionSchema = z.string().trim().max(1000, "Mô tả tối đa 1000 ký tự.");

export const createRoleFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(ROLE_CODE_PATTERN, "Mã 2–64 ký tự: chữ, số hoặc gạch dưới, bắt đầu bằng chữ cái."),
  name: roleNameSchema,
  description: roleDescriptionSchema,
  /** Mã vai trò nguồn để sao chép quyền; rỗng = vai trò trống. */
  copyPermissionsFrom: z.string(),
  dataScope: assignableDataScopeSchema,
});

/** Form: giữ đúng phạm vi hiện tại của vai trò (kể cả TEAM, BE không cho đặt mới) để không tự đổi quyền truy cập. */
export const updateRoleFormSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  dataScope: dataScopeSchema,
});

/** `UpdateRoleRequest`: bỏ `dataScope` = giữ nguyên; chỉ gửi khi người dùng đổi và là giá trị BE nhận. */
export const updateRoleInputSchema = updateRoleFormSchema.extend({
  dataScope: assignableDataScopeSchema.optional(),
});

export type CreateRoleFormValues = z.infer<typeof createRoleFormSchema>;
export type UpdateRoleFormValues = z.infer<typeof updateRoleFormSchema>;
export type UpdateRoleInputValues = z.infer<typeof updateRoleInputSchema>;
