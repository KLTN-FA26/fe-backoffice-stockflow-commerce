import { describe, expect, it } from "vitest";

import { assignedScopeOf, canEnterWarehouse } from "./assigned-warehouses";

import type { MyPermissions } from "./me-permissions";

const perms = (patch: Partial<MyPermissions>): MyPermissions => ({
  roles: [],
  permissions: [],
  dataScope: "WAREHOUSE",
  ...patch,
});
const BD = { id: "wh-bd", prefix: "BD" };

describe("kho được gán từ /me/permissions (BE #394, docs 00 phạm vi WAREHOUSE)", () => {
  it("phạm vi WAREHOUSE có danh sách kho → restricted, giữ đúng danh sách", () => {
    expect(assignedScopeOf(perms({ warehouses: [BD] }))).toEqual({
      scope: "restricted",
      warehouses: [BD],
    });
  });

  it("phạm vi WAREHOUSE nhưng BE chưa trả danh sách → unknown", () => {
    expect(assignedScopeOf(perms({})).scope).toBe("unknown");
  });

  it("phạm vi WAREHOUSE với danh sách rỗng → restricted, không kho nào", () => {
    expect(assignedScopeOf(perms({ warehouses: [] }))).toEqual({
      scope: "restricted",
      warehouses: [],
    });
  });

  it.each(["ALL", "TEAM", "OWN"] as const)(
    "phạm vi %s → all, bỏ qua danh sách kho",
    (dataScope) => {
      expect(assignedScopeOf(perms({ dataScope, warehouses: [BD] }))).toEqual({
        scope: "all",
        warehouses: [],
      });
    },
  );

  it("chưa tải được quyền → unknown", () => {
    expect(assignedScopeOf(undefined).scope).toBe("unknown");
  });
});

describe("canEnterWarehouse", () => {
  const restricted = { scope: "restricted" as const, warehouses: [BD] };

  it("restricted: kho được gán (không phân biệt hoa thường) → vào được", () => {
    expect(canEnterWarehouse(restricted, "bd")).toBe(true);
  });

  it("restricted: kho không được gán → không vào được", () => {
    expect(canEnterWarehouse(restricted, "HCM")).toBe(false);
  });

  it.each(["all", "unknown"] as const)("%s → vào được mọi kho", (scope) => {
    expect(canEnterWarehouse({ scope, warehouses: [] }, "HCM")).toBe(true);
  });
});
