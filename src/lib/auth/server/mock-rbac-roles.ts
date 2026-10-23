import "server-only";

import {
  createRoleFormSchema,
  updateRoleFormSchema,
} from "@/features/permission-management/schemas";

import { holderCount, roleStore } from "./mock-identity-store";
import { emptyMatrixOf } from "./mock-role-matrices";

import type { RoleMatrix } from "@/features/permission-management/types";

const fail = (status: number, errorCode: string, fieldErrors: string[] = []) =>
  Response.json(
    { errorCode, fieldErrors: fieldErrors.map((field) => ({ field, message: "invalid" })) },
    { status },
  );

const parseBody = (init: RequestInit): unknown => {
  const raw = init.body;
  const text =
    typeof raw === "string"
      ? raw
      : new TextDecoder().decode(
          raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? raw : new ArrayBuffer(0),
        );
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const view = async (role: ReturnType<typeof roleStore>[number]) => ({
  ...role,
  holderCount: await holderCount(role.code),
});

/**
 * Tạo / đổi tên / xoá vai trò tuỳ chỉnh của mock BE (PR #72, SCRUM-455). Quyền người gọi do
 * `mock-rbac.ts` kiểm trước; luật 409 chép từ BE: trùng mã không phân biệt hoa thường, vai trò hệ thống
 * bất biến, vai trò còn người giữ không xoá được, `version` lệch → OPTIMISTIC_LOCK.
 */
export async function mockRoleAdmin(
  method: string,
  roleCode: string | null,
  init: RequestInit,
  matrices: Map<string, RoleMatrix>,
): Promise<Response> {
  const catalog = roleStore();
  const body = method === "DELETE" ? {} : parseBody(init);
  if (method === "POST" && roleCode === null) {
    const parsed = createRoleFormSchema.safeParse({
      description: "",
      copyPermissionsFrom: "",
      dataScope: "ALL",
      ...(typeof body === "object" ? body : {}),
    });
    if (!parsed.success)
      return fail(
        400,
        "VALIDATION_FAILED",
        parsed.error.issues.map((i) => String(i.path[0])),
      );
    const { code, name, description, copyPermissionsFrom, dataScope } = parsed.data;
    if (catalog.filter((role) => role.code.toLowerCase() === code.toLowerCase()).length > 0)
      return fail(409, "ROLE_CODE_ALREADY_EXISTS");
    const source = copyPermissionsFrom ? matrices.get(copyPermissionsFrom) : undefined;
    if (copyPermissionsFrom && !source) return fail(404, "ROLE_NOT_FOUND");
    const now = new Date().toISOString();
    const role = {
      code,
      name,
      description: description || null,
      system: false,
      version: 0,
      holderCount: 0,
      dataScope,
      createdAt: now,
      createdBy: "mock",
      lastModifiedAt: null,
      lastModifiedBy: null,
    };
    catalog.push(role);
    const empty = emptyMatrixOf(role);
    matrices.set(
      code,
      source
        ? {
            ...source,
            roleCode: code,
            roleLabel: name,
            systemRole: false,
            editable: true,
            version: 0,
            dataScope,
          }
        : empty,
    );
    return Response.json(await view(role), { status: 201 });
  }
  const role = catalog.filter((candidate) => candidate.code === roleCode)[0];
  if (!role) return fail(404, "ROLE_NOT_FOUND");
  if (role.system) return fail(409, "SYSTEM_ROLE_IMMUTABLE");
  if (method === "DELETE") {
    if ((await holderCount(role.code)) > 0) return fail(409, "ROLE_IN_USE");
    catalog.splice(catalog.indexOf(role), 1);
    matrices.delete(role.code);
    return new Response(null, { status: 204 });
  }
  const parsed = updateRoleFormSchema.safeParse({
    description: "",
    dataScope: role.dataScope,
    ...(typeof body === "object" ? body : {}),
  });
  const version =
    typeof body === "object" && body !== null && "version" in body ? body.version : null;
  if (!parsed.success || typeof version !== "number")
    return fail(
      400,
      "VALIDATION_FAILED",
      parsed.success ? ["version"] : parsed.error.issues.map((i) => String(i.path[0])),
    );
  if (version !== role.version) return fail(409, "OPTIMISTIC_LOCK");
  Object.assign(role, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    dataScope: parsed.data.dataScope,
    version: role.version + 1,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: "mock",
  });
  const matrix = matrices.get(role.code);
  if (matrix)
    matrices.set(role.code, { ...matrix, roleLabel: role.name, dataScope: role.dataScope });
  return Response.json(await view(role));
}
