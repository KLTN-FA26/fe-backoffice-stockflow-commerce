import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getRolePermissionMatrix, listRoles } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("permission management API", () => {
  it("parses role audit metadata and nullable fields", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: [
        {
          code: "WAREHOUSE_MANAGER",
          name: "Warehouse Manager",
          description: null,
          createdAt: "2026-09-03T00:00:00Z",
          createdBy: null,
          lastModifiedAt: null,
          lastModifiedBy: null,
        },
      ],
    });

    await expect(listRoles()).resolves.toEqual([
      expect.objectContaining({
        code: "WAREHOUSE_MANAGER",
        description: null,
        createdBy: null,
        lastModifiedAt: null,
        lastModifiedBy: null,
      }),
    ]);
  });

  it("parses nested matrix groups, resources, actions, sensitivity, and data scope", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        roleCode: "ECOMMERCE_ADMIN",
        roleLabel: "E-commerce Admin",
        systemRole: true,
        dataScope: "WAREHOUSE",
        grantedCount: 1,
        totalCount: 2,
        groups: [
          {
            name: "Platform",
            grantedCount: 1,
            totalCount: 2,
            resources: [
              {
                code: "identity-rbac",
                label: "Permission matrix",
                route: "/admin/permissions",
                apiPath: "/api/v1/identity/rbac",
                grantedCount: 1,
                totalCount: 2,
                actions: [
                  { action: "READ", label: "Read data", granted: true, sensitive: false },
                  { action: "APPROVE", label: "Approve", granted: false, sensitive: true },
                ],
              },
            ],
          },
        ],
      },
    });

    const matrix = await getRolePermissionMatrix("ECOMMERCE_ADMIN");

    expect(matrix.dataScope).toBe("WAREHOUSE");
    expect(matrix.groups[0]?.resources[0]?.actions[1]).toMatchObject({
      action: "APPROVE",
      sensitive: true,
    });
  });

  it("uses the verified API path and encodes the role code", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        roleCode: "ROLE/ONE",
        roleLabel: "Role",
        systemRole: true,
        dataScope: "ALL",
        grantedCount: 0,
        totalCount: 0,
        groups: [],
      },
    });

    await getRolePermissionMatrix("ROLE/ONE");

    expect(get).toHaveBeenCalledWith("/v1/identity/roles/ROLE%2FONE/permissions", {
      signal: undefined,
    });
  });
});
