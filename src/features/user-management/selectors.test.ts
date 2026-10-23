import { describe, expect, it } from "vitest";

import {
  isAssignableRole,
  sameSet,
  singleStatus,
  toCreateUserRequest,
  toggleValue,
  userDisplayName,
  warehouseBoundRoles,
} from "./selectors";

describe("selectors", () => {
  it("userDisplayName falls back to the username", () => {
    expect(userDisplayName({ username: "lan", fullName: "Lan Nguyễn" })).toBe("Lan Nguyễn");
    expect(userDisplayName({ username: "lan", fullName: "  " })).toBe("lan");
    expect(userDisplayName({ username: "lan" })).toBe("lan");
  });

  it("isAssignableRole refuses the customer role (BE ROLE_NOT_ASSIGNABLE)", () => {
    expect(isAssignableRole("CUSTOMER")).toBe(false);
    expect(isAssignableRole("SHIFT_LEAD")).toBe(true);
  });

  it("toggleValue adds and removes without duplicating", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("sameSet ignores order", () => {
    expect(sameSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameSet(["a"], ["a", "b"])).toBe(false);
    expect(sameSet([], [])).toBe(true);
  });

  it("warehouseBoundRoles returns only selected roles whose data scope is WAREHOUSE (BE PR #73)", () => {
    const catalog = [
      { code: "A", dataScope: "ALL" },
      { code: "B", dataScope: "WAREHOUSE" },
      { code: "C", dataScope: "WAREHOUSE" },
    ];
    expect(warehouseBoundRoles(["A", "B"], catalog)).toEqual(["B"]);
    expect(warehouseBoundRoles(["A"], catalog)).toEqual([]);
    expect(warehouseBoundRoles(["B"], [])).toEqual([]);
  });

  it("toCreateUserRequest drops blank full name and password so the BE generates one", () => {
    expect(
      toCreateUserRequest({
        username: " lan ",
        email: " lan@x.vn ",
        fullName: " ",
        password: "",
        roles: ["A"],
        warehouseIds: [],
      }),
    ).toEqual({ username: "lan", email: "lan@x.vn", roles: ["A"], warehouseIds: [] });
    expect(
      toCreateUserRequest({
        username: "lan",
        email: "lan@x.vn",
        fullName: "Lan",
        password: "Abcdefghi1",
        roles: ["A"],
        warehouseIds: ["W"],
      }),
    ).toMatchObject({ fullName: "Lan", password: "Abcdefghi1", warehouseIds: ["W"] });
  });

  it("singleStatus filters by exactly one status", () => {
    expect(singleStatus(["LOCKED"])).toBe("LOCKED");
    expect(singleStatus([])).toBeUndefined();
    expect(singleStatus(["LOCKED", "ACTIVE"])).toBeUndefined();
  });
});
