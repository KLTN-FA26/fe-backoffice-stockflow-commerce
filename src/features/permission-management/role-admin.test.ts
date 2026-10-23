import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { customRole, roleFixture } from "./__fixtures__/roles";
import { createRole, deleteRole, updateRole } from "./api";
import { createRoleFormSchema, roleResponseSchema, updateRoleFormSchema } from "./schemas";

afterEach(() => vi.restoreAllMocks());

describe("role schemas mirror BE CreateRoleRequest / UpdateRoleRequest", () => {
  const base = {
    code: "SHIFT_LEAD",
    name: "Tổ trưởng",
    description: "",
    copyPermissionsFrom: "",
    dataScope: "ALL",
  } as const;

  it.each(["SHIFT_LEAD", "a1", "A".repeat(64), "Mixed_Case_9"])("accepts code %j", (code) => {
    expect(createRoleFormSchema.safeParse({ ...base, code }).success).toBe(true);
  });

  it.each(["", "A", "1ABC", "_ABC", "HAS SPACE", "dấu", "A".repeat(65)])(
    "rejects code %j",
    (code) => {
      expect(createRoleFormSchema.safeParse({ ...base, code }).success).toBe(false);
    },
  );

  it("requires a name up to 200 chars and a description up to 1000", () => {
    expect(createRoleFormSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(createRoleFormSchema.safeParse({ ...base, name: "x".repeat(201) }).success).toBe(false);
    expect(createRoleFormSchema.safeParse({ ...base, description: "x".repeat(1001) }).success).toBe(
      false,
    );
  });

  it("accepts only OWN / WAREHOUSE / ALL as a data scope (TEAM has no rows to apply to yet)", () => {
    for (const dataScope of ["OWN", "WAREHOUSE", "ALL"])
      expect(
        updateRoleFormSchema.safeParse({ name: "x", description: "", dataScope }).success,
      ).toBe(true);
    expect(
      updateRoleFormSchema.safeParse({ name: "x", description: "", dataScope: "TEAM" }).success,
    ).toBe(false);
  });

  it("parses the extended role response and rejects one without the new fields", () => {
    expect(roleResponseSchema.parse(customRole()).system).toBe(false);
    const { system: _system, ...withoutSystem } = roleFixture();
    expect(roleResponseSchema.safeParse(withoutSystem).success).toBe(false);
  });
});

describe("role API", () => {
  it("creates an empty role without optional keys", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: customRole() });
    await createRole({
      code: "SHIFT_LEAD",
      name: "Tổ trưởng",
      description: "",
      copyPermissionsFrom: "",
      dataScope: "WAREHOUSE",
    });
    expect(post).toHaveBeenCalledWith("/identity/roles", {
      code: "SHIFT_LEAD",
      name: "Tổ trưởng",
      dataScope: "WAREHOUSE",
    });
  });

  it("creates a copy with description and source", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: customRole() });
    await createRole({
      code: "COPY",
      name: "Copy",
      description: "Mô tả",
      copyPermissionsFrom: "ROLE_A",
      dataScope: "ALL",
    });
    expect(post.mock.calls[0]?.[1]).toEqual({
      code: "COPY",
      name: "Copy",
      dataScope: "ALL",
      description: "Mô tả",
      copyPermissionsFrom: "ROLE_A",
    });
  });

  it("patches name, description, data scope and version at the encoded role path", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: customRole({ version: 3 }) });
    await updateRole({
      roleCode: "A/B",
      values: { name: "N", description: "", dataScope: "OWN" },
      version: 2,
    });
    expect(patch).toHaveBeenCalledWith("/identity/roles/A%2FB", {
      name: "N",
      description: "",
      dataScope: "OWN",
      version: 2,
    });
  });

  it("deletes by code", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    await deleteRole("SHIFT_LEAD");
    expect(del).toHaveBeenCalledWith("/identity/roles/SHIFT_LEAD");
  });
});
