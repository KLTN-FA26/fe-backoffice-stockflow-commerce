export {
  createRole,
  deleteRole,
  getRolePermissionMatrix,
  listRoles,
  updateRole,
  updateRolePermissions,
} from "./api";
export {
  permissionActionSchema,
  dataScopeSchema,
  roleMatrixActionSchema,
  roleMatrixGroupSchema,
  roleMatrixResourceSchema,
  roleMatrixSchema,
  updateRolePermissionsSchema,
  roleResponseSchema,
} from "./schemas";
export type {
  UpdateRolePermissions,
  RoleMatrix,
  RoleMatrixAction,
  RoleMatrixGroup,
  RoleMatrixResource,
  RoleResponse,
} from "./schemas";
export { permissionManagementKeys, useRolePermissionMatrix, useRoles } from "./queries";

export { useUpdateRolePermissions } from "./mutations";
export { useCreateRole, useDeleteRole, useUpdateRole } from "./role-mutations";
