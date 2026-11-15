import { describe, expect, it } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants/permissions";

import {
  allowedActions,
  canTransition,
  canViewPrintConfig,
  isTerminal,
  PRINT_CONFIG_TRANSITIONS,
  statusOfPrintConfig,
} from "./lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const role =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);
const EDITOR = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update);
const VIEWER = role(PRODUCT_PERMISSIONS.read);
const codes = (actions: readonly { code: string }[]) => actions.map((a) => a.code);

describe("print configuration lifecycle", () => {
  it("status follows the BE `active` flag; activation and deactivation toggle it; none is terminal", () => {
    expect(statusOfPrintConfig({ active: true })).toBe("ACTIVE");
    expect(statusOfPrintConfig({ active: false })).toBe("INACTIVE");
    expect(canTransition(PRINT_CONFIG_TRANSITIONS, "INACTIVE", "ACTIVE")).toBe(true);
    expect(canTransition(PRINT_CONFIG_TRANSITIONS, "ACTIVE", "INACTIVE")).toBe(true);
    expect(canTransition(PRINT_CONFIG_TRANSITIONS, "ACTIVE", "ACTIVE")).toBe(false);
    expect(isTerminal(PRINT_CONFIG_TRANSITIONS, "ACTIVE")).toBe(false);
  });

  it("an editor may save, and activate or deactivate by status", () => {
    expect(codes(allowedActions(null, EDITOR))).toEqual(["save"]);
    expect(codes(allowedActions("INACTIVE", EDITOR))).toEqual(["save", "activate"]);
    expect(codes(allowedActions("ACTIVE", EDITOR))).toEqual(["save", "deactivate"]);
  });

  it("a view-only role sees no action; no read permission, no view", () => {
    expect(allowedActions("ACTIVE", VIEWER)).toEqual([]);
    expect(canViewPrintConfig(VIEWER)).toBe(true);
    expect(canViewPrintConfig(role())).toBe(false);
    expect(allowedActions(null, role(PRODUCT_PERMISSIONS.update))).toEqual([]);
  });

  it("a discontinued product or obsolete variant (writable: false) gets no action", () => {
    expect(allowedActions("ACTIVE", EDITOR, { writable: false })).toEqual([]);
  });
});
