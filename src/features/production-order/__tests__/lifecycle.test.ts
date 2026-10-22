import { describe, expect, it } from "vitest";

import { PRODUCTION_API_STATUSES } from "@/constants";

import { PRODUCTION_TRANSITIONS } from "../lifecycle";
import { qcCompletesOrder } from "../selectors";

describe("PRODUCTION_TRANSITIONS (BE ProductionOrder, develop 492a2d61)", () => {
  it("covers every BE status, and only BE statuses as targets", () => {
    expect(Object.keys(PRODUCTION_TRANSITIONS).sort()).toEqual([...PRODUCTION_API_STATUSES].sort());
    for (const targets of Object.values(PRODUCTION_TRANSITIONS))
      for (const target of targets) expect(PRODUCTION_API_STATUSES).toContain(target);
  });

  it("COMPLETED and CANCELLED are terminal — no transition", () => {
    expect(PRODUCTION_TRANSITIONS.COMPLETED).toEqual([]);
    expect(PRODUCTION_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("BR-PRD-02: prepress PASS → READY, FAIL → ON_HOLD; nothing skips prepress", () => {
    expect(PRODUCTION_TRANSITIONS.PENDING_PREPRESS).toEqual(["READY", "ON_HOLD", "CANCELLED"]);
  });

  it("printing only from MATERIAL_ISSUED (BR-PRD-03: blanks issued first)", () => {
    const into = Object.entries(PRODUCTION_TRANSITIONS)
      .filter(([, targets]) => targets.includes("PRINTING"))
      .map(([from]) => from);
    expect(into.sort()).toEqual(["MATERIAL_ISSUED", "ON_HOLD"]);
  });

  it("system moves of subcontracting: goods after a short QC (READY → QC), take-back completes", () => {
    expect(PRODUCTION_TRANSITIONS.READY).toEqual(expect.arrayContaining(["QC", "COMPLETED"]));
    expect(PRODUCTION_TRANSITIONS.ON_HOLD).toContain("COMPLETED");
    expect(PRODUCTION_TRANSITIONS.SUBCONTRACTED).toContain("COMPLETED");
  });

  it("a cancelled order cannot be printed or completed afterwards, and QC never goes back to print", () => {
    expect(PRODUCTION_TRANSITIONS.QC).not.toContain("PRINTING");
    expect(PRODUCTION_TRANSITIONS.MATERIAL_ISSUED).not.toContain("COMPLETED");
  });
});

describe("qcCompletesOrder — only the completing QC round needs a PACKING area (SCRUM-412)", () => {
  const summary = { goodQuantity: 1000, plannedQuantity: 1000 };

  it("all good → COMPLETED (hand-over)", () => {
    expect(qcCompletesOrder(summary, 0)).toBe(true);
  });

  it("any failed unit left short → back to READY, no hand-over", () => {
    expect(qcCompletesOrder(summary, 1)).toBe(false);
  });

  it("over-printed good units absorb the failed ones", () => {
    expect(qcCompletesOrder({ goodQuantity: 1050, plannedQuantity: 1000 }, 50)).toBe(true);
    expect(qcCompletesOrder({ goodQuantity: 1050, plannedQuantity: 1000 }, 51)).toBe(false);
  });
});
