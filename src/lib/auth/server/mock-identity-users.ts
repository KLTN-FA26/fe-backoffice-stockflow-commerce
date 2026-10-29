import "server-only";

import { IDENTITY_PERMISSIONS } from "@/constants/permissions";
import { USER_LIMITS } from "@/features/user-management/constants";
import { createUserFormSchema, updateUserFormSchema } from "@/features/user-management/schemas";

import { holdsRole, roleStore, statusHistoryOf, userStore } from "./mock-identity-store";
import { bodyOf, listUsers } from "./mock-identity-util";
import { MOCK_TOP_ROLE } from "./mock-role-matrices";

import type { MockStatusChange, MockUser } from "./mock-identity-store";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, errorCode: string, fields: string[] = []) =>
  json(
    {
      success: false,
      errorCode,
      fieldErrors: fields.map((field) => ({ field, message: "invalid" })),
    },
    status,
  );

const temporaryPassword = () => `Tmp-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}9a`;

/** Còn ít nhất một quản trị viên ACTIVE khác `user` (mock của BE `LAST_SYSTEM_ADMIN`). */
const losesLastAdmin = (users: MockUser[], user: MockUser) =>
  holdsRole(user, MOCK_TOP_ROLE) &&
  user.status === "ACTIVE" &&
  !users.some((u) => u !== user && u.status === "ACTIVE" && holdsRole(u, MOCK_TOP_ROLE));

const ACTION_NAMES = {
  lock: "LOCK",
  unlock: "UNLOCK",
  disable: "DISABLE",
  enable: "ENABLE",
} as const;

const NEXT: Record<string, (user: MockUser) => MockUser["status"] | null> = {
  lock: (u) => (u.status === "DISABLED" ? null : "LOCKED"),
  unlock: (u) => (u.status === "DISABLED" ? null : "ACTIVE"),
  disable: () => "DISABLED",
  enable: (u) => (u.status === "LOCKED" ? null : "ACTIVE"),
};

/**
 * Mock `UserManagementController` + `/users/{id}/roles` (BE PR #72/#73): lọc / sắp xếp / phân trang,
 * tạo (sinh mật khẩu tạm khi không gửi), sửa có `version`, kho, khoá / vô hiệu hoá, đặt lại mật khẩu và
 * các luật 403/409 có thể kiểm bằng dữ liệu mock (tài khoản của chính mình, quản trị viên cuối, trùng tên).
 */
export async function mockUsersBackend(
  path: string,
  init: RequestInit,
  permissions: readonly string[],
  callerId: string,
  query: URLSearchParams,
): Promise<Response | null> {
  const match = /^identity\/users(?:\/([^/]+)(?:\/(.+))?)?$/.exec(path);
  if (!match) return null;
  const method = init.method ?? "GET";
  const need =
    method === "GET"
      ? IDENTITY_PERMISSIONS.usersRead
      : method === "POST" && !match[1]
        ? IDENTITY_PERMISSIONS.usersCreate
        : IDENTITY_PERMISSIONS.usersUpdate;
  if (!permissions.includes(need)) return fail(403, "FORBIDDEN");
  const users = await userStore();
  const [, id, action] = match;
  if (!id) return method === "GET" ? json(listUsers(users, query)) : create(users, bodyOf(init));
  const user = users.find((candidate) => candidate.userId === decodeURIComponent(id));
  if (!user) return fail(404, "USER_NOT_FOUND");
  if (method === "GET" && action === "status-changes") return json(historyPage(user, query));
  if (method === "GET") return json(user);
  if (user.userId === callerId) return fail(403, "OWN_ACCOUNT_NOT_MANAGEABLE");
  return mutate(users, user, method, action ?? "", bodyOf(init), callerId);
}

/** `GET /identity/users/{id}/status-changes`: paged like the BE `PageResponse`, newest first. */
function historyPage(user: MockUser, query: URLSearchParams) {
  const history = statusHistoryOf(user);
  const size = Number(query.get("size") ?? 20);
  const page = Number(query.get("page") ?? 0);
  const totalPages = Math.ceil(history.length / size);
  return {
    items: history.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: history.length,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

async function create(users: MockUser[], body: Record<string, unknown>) {
  const parsed = createUserFormSchema.safeParse({
    fullName: "",
    password: "",
    warehouseIds: [],
    ...body,
  });
  if (!parsed.success)
    return fail(
      400,
      "VALIDATION_FAILED",
      parsed.error.issues.map((i) => String(i.path[0])),
    );
  const { username, email, fullName, password, roles, warehouseIds } = parsed.data;
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
    return fail(409, "USERNAME_ALREADY_EXISTS");
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    return fail(409, "USER_EMAIL_ALREADY_EXISTS");
  const known = new Set(roleStore().map((role) => role.code));
  if (roles.filter((code) => !known.has(code)).length > 0) return fail(404, "ROLE_NOT_FOUND");
  const generated = password ? null : temporaryPassword();
  const user: MockUser = {
    userId: crypto.randomUUID(),
    username,
    email,
    fullName: fullName || null,
    status: "ACTIVE",
    roles,
    warehouseIds,
    mustChangePassword: true,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    createdBy: "mock",
    version: 0,
  };
  users.push(user);
  return json({ user, temporaryPassword: generated }, 201);
}

function mutate(
  users: MockUser[],
  user: MockUser,
  method: string,
  action: string,
  body: Record<string, unknown>,
  callerId: string,
) {
  const touch = () => {
    user.version += 1;
    return json(user);
  };
  if (method === "PATCH") {
    const parsed = updateUserFormSchema.safeParse(body);
    if (!parsed.success || typeof body.version !== "number") return fail(400, "VALIDATION_FAILED");
    if (body.version !== user.version) return fail(409, "OPTIMISTIC_LOCK");
    const email = parsed.data.email;
    if (users.some((u) => u !== user && u.email.toLowerCase() === email.toLowerCase()))
      return fail(409, "USER_EMAIL_ALREADY_EXISTS");
    Object.assign(user, { email, fullName: parsed.data.fullName || null });
    return touch();
  }
  if (method === "PUT" && action === "warehouses") {
    const ids = Array.isArray(body.warehouseIds) ? body.warehouseIds.map(String) : null;
    if (!ids || ids.length > USER_LIMITS.warehousesMax)
      return fail(400, "VALIDATION_FAILED", ["warehouseIds"]);
    user.warehouseIds = ids;
    return json(user);
  }
  if (action === "roles" && method === "POST") {
    const code = String(body.roleCode ?? "");
    if (!roleStore().some((role) => role.code === code)) return fail(404, "ROLE_NOT_FOUND");
    if (!holdsRole(user, code)) user.roles.push(code);
    return json(null, 201);
  }
  if (action.startsWith("roles/") && method === "DELETE") {
    const code = decodeURIComponent(action.slice("roles/".length));
    if (code === MOCK_TOP_ROLE && losesLastAdmin(users, user))
      return fail(409, "LAST_SYSTEM_ADMIN");
    user.roles = user.roles.filter((held) => held !== code);
    return json(null);
  }
  if (action === "password-reset" && method === "POST") {
    const given = typeof body.newPassword === "string" ? body.newPassword : null;
    if (
      given &&
      !(given.length >= USER_LIMITS.passwordMin && USER_LIMITS.passwordPattern.test(given))
    )
      return fail(400, "VALIDATION_FAILED", ["newPassword"]);
    user.mustChangePassword = true;
    return json({ temporaryPassword: given ? null : temporaryPassword(), sessionsEnded: 1 });
  }
  const next = method === "POST" ? NEXT[action]?.(user) : undefined;
  if (next === undefined) return fail(405, "METHOD_NOT_ALLOWED");
  // SCRUM-474 LOCK-REASON: the BE checks the reason first - 5 to 500 characters after trimming.
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonLength = [...reason].length;
  if (reasonLength < USER_LIMITS.reasonMin || reasonLength > USER_LIMITS.reasonMax)
    return fail(400, "VALIDATION_FAILED", ["reason"]);
  if (next === null) return fail(409, "INVALID_USER_STATUS_TRANSITION");
  if (next !== "ACTIVE" && losesLastAdmin(users, user)) return fail(409, "LAST_SYSTEM_ADMIN");
  const entry = {
    id: crypto.randomUUID(),
    action: ACTION_NAMES[action as keyof typeof ACTION_NAMES],
    fromStatus: user.status,
    toStatus: next,
    reason,
    actorId: callerId,
    actorUsername: users.find((u) => u.userId === callerId)?.username ?? "mock",
    changedAt: new Date().toISOString(),
  } satisfies MockStatusChange;
  user.status = next;
  user.lockedUntil = null;
  user.latestStatusChange = entry;
  statusHistoryOf(user).unshift(entry);
  return touch();
}
