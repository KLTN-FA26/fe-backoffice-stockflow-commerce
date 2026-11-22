import { describe, expect, it } from "vitest";

import {
  CUSTOMIZATION_TEMPLATE_PERMISSIONS as TEMPLATE,
  PRODUCT_PERMISSIONS,
} from "@/constants/permissions";

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
const EDITOR = role(TEMPLATE.read, TEMPLATE.create, TEMPLATE.update);
const VIEWER = role(TEMPLATE.read);
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
    expect(allowedActions(null, role(TEMPLATE.update))).toEqual([]);
  });

  it("product permissions do nothing here: sales staff read and update products, not templates", () => {
    const salesStaff = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update);
    expect(canViewPrintConfig(salesStaff)).toBe(false);
    expect(allowedActions("ACTIVE", salesStaff)).toEqual([]);
    expect(allowedActions(null, salesStaff)).toEqual([]);
  });

  it("each action asks for its BE permission: UPDATE saves, activates and deactivates; CREATE alone makes the first save", () => {
    const updater = role(TEMPLATE.read, TEMPLATE.update);
    expect(codes(allowedActions("INACTIVE", updater))).toEqual(["save", "activate"]);
    expect(codes(allowedActions("ACTIVE", updater))).toEqual(["save", "deactivate"]);
    // No configuration yet: the save is one multipart POST, which the BE guards with CREATE only.
    expect(allowedActions(null, updater)).toEqual([]);
    expect(codes(allowedActions(null, role(TEMPLATE.read, TEMPLATE.create)))).toEqual(["save"]);
    expect(codes(allowedActions(null, EDITOR))).toEqual(["save"]);
    // CREATE alone changes nothing of a saved configuration.
    expect(allowedActions("ACTIVE", role(TEMPLATE.read, TEMPLATE.create))).toEqual([]);
    // UPDATE without READ cannot even view.
    expect(allowedActions("ACTIVE", role(TEMPLATE.update))).toEqual([]);
  });

  it("a discontinued product or obsolete variant (writable: false) keeps only the stop (BE deactivate skips requireWritable)", () => {
    expect(codes(allowedActions("ACTIVE", EDITOR, { writable: false }))).toEqual(["deactivate"]);
    expect(allowedActions("INACTIVE", EDITOR, { writable: false })).toEqual([]);
    expect(allowedActions(null, EDITOR, { writable: false })).toEqual([]);
    // Still needs the permission.
    expect(allowedActions("ACTIVE", role(TEMPLATE.read), { writable: false })).toEqual([]);
  });

  it("a configuration whose file or area table does not allow it is not offered activation; the rest stays", () => {
    expect(codes(allowedActions("INACTIVE", EDITOR, { activatable: false }))).toEqual(["save"]);
    expect(codes(allowedActions("ACTIVE", EDITOR, { activatable: false }))).toEqual([
      "save",
      "deactivate",
    ]);
    expect(codes(allowedActions("INACTIVE", EDITOR, { activatable: true }))).toEqual([
      "save",
      "activate",
    ]);
  });
});
