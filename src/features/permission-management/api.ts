import { api } from "@/lib/api/client";

import { roleMatrixSchema, roleResponseSchema } from "./schemas";

import type { RoleMatrix, RoleResponse } from "./schemas";

export async function listRoles(signal?: AbortSignal): Promise<RoleResponse[]> {
  const { data } = await api.get<unknown>("/v1/identity/roles", { signal });
  return roleResponseSchema.array().parse(data);
}

export async function getRolePermissionMatrix(
  roleCode: string,
  signal?: AbortSignal,
): Promise<RoleMatrix> {
  const { data } = await api.get<unknown>(
    `/v1/identity/roles/${encodeURIComponent(roleCode)}/permissions`,
    { signal },
  );
  return roleMatrixSchema.parse(data);
}
