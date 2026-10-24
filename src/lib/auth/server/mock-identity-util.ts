import "server-only";

import { holdsRole } from "./mock-identity-store";

import type { MockUser } from "./mock-identity-store";

export function bodyOf(init: RequestInit): Record<string, unknown> {
  const raw = init.body;
  const text =
    typeof raw === "string"
      ? raw
      : new TextDecoder().decode(
          raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? raw : new ArrayBuffer(0),
        );
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Lọc / sắp xếp / phân trang như `GET /identity/users` (q, status, role, sort, page, size). */
export function listUsers(users: MockUser[], query: URLSearchParams) {
  const q = (query.get("q") ?? "").trim().toLowerCase();
  const status = query.get("status");
  const role = query.get("role");
  const [sortKey = "username", dir = "asc"] = (query.get("sort") ?? "username,asc").split(",");
  const matched = users
    .filter((u) => !status || u.status === status)
    .filter((u) => !role || holdsRole(u, role))
    .filter(
      (u) => !q || [u.username, u.email, u.fullName ?? ""].some((v) => v.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const left = String((a as unknown as Record<string, unknown>)[sortKey] ?? "");
      const right = String((b as unknown as Record<string, unknown>)[sortKey] ?? "");
      return dir === "desc" ? right.localeCompare(left) : left.localeCompare(right);
    });
  const size = Number(query.get("size") ?? 20);
  const page = Number(query.get("page") ?? 0);
  const totalPages = Math.ceil(matched.length / size);
  return {
    items: matched.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: matched.length,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}
