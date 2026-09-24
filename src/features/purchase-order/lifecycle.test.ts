import { describe, expect, it } from "vitest";

import { allowedPoActions, nextPoStatuses } from "./lifecycle";

import type { PoStatus } from "./types";

describe("purchase-order lifecycle (BE 7-state)", () => {
  it("allows DRAFT -> APPROVED | CANCELLED", () => {
    expect(nextPoStatuses("DRAFT" as PoStatus)).toEqual([
      "APPROVED",
      "CANCELLED",
    ] satisfies PoStatus[]);
  });

  it("does not allow terminal statuses to transition", () => {
    expect(nextPoStatuses("CLOSED" as PoStatus)).toEqual([]);
    expect(nextPoStatuses("CANCELLED" as PoStatus)).toEqual([]);
    expect(nextPoStatuses("CLOSED_SHORT" as PoStatus)).toEqual([]);
  });

  it("allows APPROVED -> SENT | CANCELLED", () => {
    expect(nextPoStatuses("APPROVED" as PoStatus)).toEqual([
      "SENT",
      "CANCELLED",
    ] satisfies PoStatus[]);
  });

  it("gates DRAFT approve by Warehouse Manager (po.approve)", () => {
    expect(allowedPoActions("DRAFT" as PoStatus, "Warehouse Manager").map((a) => a.code)).toContain(
      "approve",
    );
  });

  it("does not allow Procurement Staff to approve DRAFT", () => {
    expect(
      allowedPoActions("DRAFT" as PoStatus, "Procurement Staff").map((a) => a.code),
    ).not.toContain("approve");
  });

  it("gates SENT cancel by po.update", () => {
    expect(allowedPoActions("SENT" as PoStatus, "Procurement Staff").map((a) => a.code)).toContain(
      "cancel",
    );
  });

  it("terminal CLOSED has no mutating actions", () => {
    const codes = allowedPoActions("CLOSED" as PoStatus, "Warehouse Manager").map((a) => a.code);
    expect(codes.filter((c) => ["approve", "send", "cancel", "closeShort"].includes(c))).toEqual(
      [],
    );
  });
});
