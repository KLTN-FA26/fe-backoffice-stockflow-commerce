import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getRolePermissionMatrix, listRoles } from "./api";
import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";

const originalAdapter = api.defaults.adapter;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("permission management mock read routes", () => {
  it("returns role audit metadata from the role list route", async () => {
    const roles = await listRoles();

    expect(roles).toHaveLength(2);
    expect(roles[0]).toMatchObject({
      code: "ECOMMERCE_ADMIN",
      createdAt: "2026-09-03T00:00:00Z",
    });
    expect(roles[1]?.description).toBeNull();
  });

  it("returns a normal nested matrix and preserves sensitive actions", async () => {
    const matrix = await getRolePermissionMatrix("ECOMMERCE_ADMIN");

    expect(matrix.groups[0]?.resources[0]?.actions).toEqual([
      { action: "VIEW_PAGE", label: "Open page", granted: true, sensitive: false },
      { action: "READ", label: "Read data", granted: true, sensitive: false },
      { action: "APPROVE", label: "Approve", granted: false, sensitive: true },
    ]);
  });

  it.each([
    ["EMPTY_GROUPS", 0, 0, 0],
    ["EMPTY_RESOURCES", 1, 0, 0],
    ["EMPTY_ACTIONS", 1, 1, 0],
  ] as const)(
    "supports empty matrix shape %s",
    async (roleCode, groupCount, resourceCount, actionCount) => {
      const matrix = await getRolePermissionMatrix(roleCode);

      expect(matrix.groups).toHaveLength(groupCount);
      expect(matrix.groups.flatMap((group) => group.resources)).toHaveLength(resourceCount);
      expect(
        matrix.groups.flatMap((group) => group.resources.flatMap((resource) => resource.actions)),
      ).toHaveLength(actionCount);
    },
  );

  it("propagates unknown role as ApiError 404", async () => {
    await expect(getRolePermissionMatrix("UNKNOWN_ROLE")).rejects.toMatchObject({
      status: 404,
      code: "ROLE_NOT_FOUND",
    });
  });

  it("propagates forbidden matrix access as ApiError 403", async () => {
    await expect(getRolePermissionMatrix("FORBIDDEN")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });
});
