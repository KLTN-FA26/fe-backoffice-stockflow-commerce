import "server-only";

import { toBackendRoles } from "@/lib/api/mock-backend-roles";
import { mockGrantsOf } from "@/lib/api/mock-user-grants";

export function mockSessionPermissions(userId: string, roles: readonly string[]) {
  return {
    // BE trả mã vai trò (`MyPermissionsResponse.roles`) — chỉ để hiển thị, FE không gate theo mã này
    roles: toBackendRoles(roles),
    permissions: [...mockGrantsOf(userId)].sort(),
    dataScope: "ALL" as const,
  };
}
