import "server-only";

import { IDENTITY_PERMISSIONS } from "@/constants/permissions";

import { RBAC_ERRORS } from "@/features/permission-management/constants";
import { updateRolePermissionsSchema } from "@/features/permission-management/schemas";
import { draftMatrix, matrixPermissionCode } from "@/features/permission-management/selectors";

import { holderCount, roleStore } from "./mock-identity-store";
import { mockRoleAdmin } from "./mock-rbac-roles";
import { initialMockRoleMatrices } from "./mock-role-matrices";

import type { RoleMatrix } from "@/features/permission-management/types";

const runtime = globalThis as typeof globalThis & {
  stockflowMockRoleMatrices?: Map<string, RoleMatrix>;
};
const matrices = (runtime.stockflowMockRoleMatrices ??= new Map(
  Object.entries(initialMockRoleMatrices),
));
/** Quyền BE cần cho từng phương thức trên `/identity/roles[/{code}]` (PR #72). */
const ROLE_ADMIN_PERMISSION: Record<string, string> = {
  POST: IDENTITY_PERMISSIONS.rolesCreate,
  PATCH: IDENTITY_PERMISSIONS.rolesUpdate,
  DELETE: IDENTITY_PERMISSIONS.rolesDelete,
};
function failure(status: number, errorCode: string): Response {
  return Response.json({ errorCode }, { status });
}

/** Mock server boundary: explicit grants, optimistic version and editability; no role-derived auth. */
export async function mockRbacBackend(
  path: string,
  init: RequestInit,
  permissions: readonly string[],
): Promise<Response | null> {
  if (path === "identity/roles" && init.method === "GET") {
    return permissions.includes(IDENTITY_PERMISSIONS.rolesRead)
      ? Response.json(
          await Promise.all(
            roleStore().map(async (role) => ({
              ...role,
              holderCount: await holderCount(role.code),
            })),
          ),
        )
      : failure(403, "FORBIDDEN");
  }
  const admin = ROLE_ADMIN_PERMISSION[init.method ?? ""];
  const adminMatch = /^identity\/roles(?:\/([^/]+))?$/.exec(path);
  if (admin && adminMatch) {
    if (!permissions.includes(admin)) return failure(403, "FORBIDDEN");
    const code = adminMatch[1] ? decodeURIComponent(adminMatch[1]) : null;
    return mockRoleAdmin(init.method ?? "", code, init, matrices);
  }
  const match = /^identity\/roles\/([^/]+)\/permissions$/.exec(path);
  if (!match?.[1]) return null;
  const roleCode = decodeURIComponent(match[1]);
  if (roleCode === "FORBIDDEN") return failure(403, "FORBIDDEN");
  const required =
    init.method === "PUT" ? IDENTITY_PERMISSIONS.rbacApprove : IDENTITY_PERMISSIONS.rbacRead;
  if (!permissions.includes(required)) return failure(403, "FORBIDDEN");
  const matrix = matrices.get(roleCode);
  if (!matrix) return failure(404, "ROLE_NOT_FOUND");
  if (init.method === "GET") return Response.json(matrix);
  if (init.method !== "PUT") return failure(405, "METHOD_NOT_ALLOWED");
  if (!matrix.editable) return failure(409, RBAC_ERRORS.notEditable);
  const raw = init.body;
  // The proxy forwards its bounded read as a Uint8Array; accept any byte view, like Spring would.
  const text =
    typeof raw === "string"
      ? raw
      : new TextDecoder().decode(
          raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? raw : new ArrayBuffer(0),
        );
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failure(400, "INVALID_REQUEST");
  }
  const parsed = updateRolePermissionsSchema.safeParse(body);
  if (!parsed.success) return failure(400, "INVALID_REQUEST");
  if (matrix.version !== parsed.data.version) return failure(409, RBAC_ERRORS.conflict);
  const known = new Set(
    matrix.groups.flatMap((group) =>
      group.resources.flatMap((resource) =>
        resource.actions.map((action) => matrixPermissionCode(resource.code, action.action)),
      ),
    ),
  );
  if (parsed.data.permissions.some((code) => !known.has(code)))
    return failure(400, RBAC_ERRORS.unknown);
  const saved = {
    ...draftMatrix(matrix, new Set(parsed.data.permissions)),
    version: matrix.version + 1,
  };
  matrices.set(roleCode, saved);
  return Response.json(saved);
}
