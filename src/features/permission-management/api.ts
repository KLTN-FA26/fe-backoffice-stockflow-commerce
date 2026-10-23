import { api } from "@/lib/api/client";

import {
  createRoleFormSchema,
  roleMatrixSchema,
  roleResponseSchema,
  updateRoleInputSchema,
  updateRolePermissionsSchema,
} from "./schemas";

import type {
  CreateRoleFormValues,
  RoleMatrix,
  RoleResponse,
  UpdateRoleInputValues,
  UpdateRolePermissions,
} from "./schemas";

const roleMatrixPath = (roleCode: string) =>
  `/identity/roles/${encodeURIComponent(roleCode)}/permissions`;

export async function listRoles(signal?: AbortSignal): Promise<RoleResponse[]> {
  const { data } = await api.get<unknown>("/identity/roles", { signal });
  return roleResponseSchema.array().parse(data);
}

export async function getRolePermissionMatrix(
  roleCode: string,
  signal?: AbortSignal,
): Promise<RoleMatrix> {
  const { data } = await api.get<unknown>(roleMatrixPath(roleCode), { signal });
  return roleMatrixSchema.parse(data);
}

export async function updateRolePermissions(
  roleCode: string,
  input: UpdateRolePermissions,
): Promise<RoleMatrix> {
  const { data } = await api.put<unknown>(
    roleMatrixPath(roleCode),
    updateRolePermissionsSchema.parse(input),
  );
  return roleMatrixSchema.parse(data);
}

const rolePath = (roleCode: string) => `/identity/roles/${encodeURIComponent(roleCode)}`;

/** `POST /identity/roles` — vai trò trống, hoặc sao chép quyền của vai trò khác (BE chặn nếu người gọi không giữ hết quyền đó). */
export async function createRole(values: CreateRoleFormValues): Promise<RoleResponse> {
  const { code, name, description, copyPermissionsFrom, dataScope } =
    createRoleFormSchema.parse(values);
  const { data } = await api.post<unknown>("/identity/roles", {
    code,
    name,
    dataScope,
    ...(description ? { description } : {}),
    ...(copyPermissionsFrom ? { copyPermissionsFrom } : {}),
  });
  return roleResponseSchema.parse(data);
}

export interface UpdateRoleInput {
  roleCode: string;
  values: UpdateRoleInputValues;
  /** `version` của vai trò lúc tải — BE 409 OPTIMISTIC_LOCK nếu đã đổi. */
  version: number;
}

/** `PATCH /identity/roles/{code}` — chỉ vai trò tuỳ chỉnh; vai trò hệ thống → 409 SYSTEM_ROLE_IMMUTABLE. */
export async function updateRole({
  roleCode,
  values,
  version,
}: UpdateRoleInput): Promise<RoleResponse> {
  const { name, description, dataScope } = updateRoleInputSchema.parse(values);
  const { data } = await api.patch<unknown>(rolePath(roleCode), {
    name,
    description,
    ...(dataScope ? { dataScope } : {}),
    version,
  });
  return roleResponseSchema.parse(data);
}

/** `DELETE /identity/roles/{code}` — vai trò tuỳ chỉnh không còn ai giữ. */
export async function deleteRole(roleCode: string): Promise<void> {
  await api.delete(rolePath(roleCode));
}
