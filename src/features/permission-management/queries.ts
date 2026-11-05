import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getRolePermissionMatrix, listRoles } from "./api";

export const permissionManagementKeys = {
  all: ["permission-management"] as const,
  roles: () => ["permission-management", "roles"] as const,
  matrix: (roleCode: string) => ["permission-management", "matrix", roleCode] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: permissionManagementKeys.roles(),
    queryFn: ({ signal }) => listRoles(signal),
    ...QUERY_TIMES.master,
  });
}

export function useRolePermissionMatrix(roleCode: string) {
  return useQuery({
    queryKey: permissionManagementKeys.matrix(roleCode),
    queryFn: ({ signal }) => getRolePermissionMatrix(roleCode, signal),
    enabled: roleCode.trim().length > 0,
    ...QUERY_TIMES.detail,
  });
}
