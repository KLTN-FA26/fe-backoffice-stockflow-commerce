import { describe, expect, it } from "vitest";

import { PO_STATUSES } from "@/constants";
import { allowedTransitions, canTransition, isTerminal } from "@/lib/domain/lifecycle";

import { PO_TRANSITIONS, allowedPoActions, isPoTerminal, nextPoStatuses } from "./lifecycle";

import type { RoleName } from "@/lib/auth/roles";
import type { PoStatus } from "./types";

const codes = (status: PoStatus, roles: RoleName[]) =>
  allowedPoActions(status, roles).map((a) => a.code);
const MUTATING = ["approve", "send", "cancel", "closeShort", "receive"];

describe("PO_TRANSITIONS (BE PurchaseOrderStatus#canTransitionTo, 7-state)", () => {
  it("has an entry for every BE status", () => {
    expect(Object.keys(PO_TRANSITIONS).sort()).toEqual([...PO_STATUSES].sort());
  });

  it("DRAFT → APPROVED | CANCELLED", () => {
    expect(nextPoStatuses("DRAFT")).toEqual(["APPROVED", "CANCELLED"]);
  });

  it("APPROVED → SENT | CANCELLED", () => {
    expect(nextPoStatuses("APPROVED")).toEqual(["SENT", "CANCELLED"]);
  });

  it("BR-05 (docs 02 §6): PARTIALLY_RECEIVED không thể CANCELLED — chỉ short-close", () => {
    expect(nextPoStatuses("PARTIALLY_RECEIVED")).toEqual(["CLOSED_SHORT"]);
  });

  it.each(["CLOSED", "CLOSED_SHORT", "CANCELLED"] as const)("%s is terminal", (s) => {
    expect(PO_TRANSITIONS[s]).toEqual([]);
    expect(isPoTerminal(s)).toBe(true);
  });
});

describe("generic lifecycle helpers — unknown status must not crash", () => {
  // Regression: `isTerminal(table, undefined-key)` used to throw `undefined.length`
  // and took down /admin/purchase-orders/[id].
  const table: Record<string, readonly string[]> = PO_TRANSITIONS;

  it("isTerminal treats an unknown status as terminal", () => {
    expect(isTerminal(table, "Draft")).toBe(true);
  });

  it("canTransition returns false for an unknown status", () => {
    expect(canTransition(table, "Draft", "APPROVED")).toBe(false);
  });

  it("allowedTransitions returns [] for an unknown status", () => {
    expect(allowedTransitions(table, "Draft")).toEqual([]);
  });
});

describe("allowedPoActions (action-gating by status + roles)", () => {
  it("DRAFT + Warehouse Manager → can approve", () => {
    expect(codes("DRAFT", ["Warehouse Manager"])).toContain("approve");
  });

  it("DRAFT + Procurement Staff → cannot approve (po.approve)", () => {
    expect(codes("DRAFT", ["Procurement Staff"])).not.toContain("approve");
    expect(codes("DRAFT", ["Procurement Staff"])).toContain("cancel");
  });

  it("BR-03: SENT (≙ Confirmed) + Procurement Staff → cancel và receive", () => {
    expect(codes("SENT", ["Procurement Staff"])).toEqual(["cancel", "receive"]);
  });

  it("BR-03 + BR-05: PARTIALLY_RECEIVED → closeShort và receive, không có cancel", () => {
    expect(codes("PARTIALLY_RECEIVED", ["Procurement Staff"])).toEqual(["closeShort", "receive"]);
  });

  it("Accountant (view only) sees no mutating action", () => {
    expect(codes("DRAFT", ["Accountant"])).toEqual([]);
  });

  it("uses ALL roles — Procurement Staff + Warehouse Manager can approve", () => {
    expect(codes("DRAFT", ["Procurement Staff", "Warehouse Manager"])).toContain("approve");
  });

  it.each(["DRAFT", "APPROVED"] as const)("BR-03: %s chưa chốt → không có receive", (s) => {
    expect(codes(s, ["System Admin"])).not.toContain("receive");
  });

  it("no role → no action", () => {
    expect(codes("DRAFT", [])).toEqual([]);
  });

  it.each(["CLOSED", "CLOSED_SHORT", "CANCELLED"] as const)(
    "%s renders no mutating action even for System Admin",
    (s) => {
      expect(codes(s, ["System Admin"]).filter((c) => MUTATING.includes(c))).toEqual([]);
    },
  );
});
