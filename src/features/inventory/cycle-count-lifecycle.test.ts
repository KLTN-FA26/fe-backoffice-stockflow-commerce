import { describe, expect, it } from "vitest";

import {
  CYCLE_COUNT_ACTION,
  CYCLE_COUNT_STATUS,
  CYCLE_COUNT_STATUSES,
} from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";
import { statusLabelVi, toneOf } from "@/lib/status-map";

import {
  CYCLE_COUNT_TRANSITIONS,
  allowedCycleCountActions,
  canCountCycleCount,
  isCycleCountOpen,
} from "./cycle-count-lifecycle";

import type { PermissionCode } from "@/lib/auth";

function granted(...codes: PermissionCode[]) {
  return (code: PermissionCode) => codes.includes(code);
}

const P = CYCLE_COUNT_PERMISSIONS;
// Seeded: the counter (warehouse staff) has VIEW_PAGE, READ, UPDATE; the manager has everything.
const roles = {
  none: granted(),
  counter: granted(P.viewPage, P.read, P.update),
  manager: granted(P.viewPage, P.read, P.create, P.update, P.approve),
  readOnly: granted(P.viewPage, P.read),
};

describe("cycle count lifecycle (docs 20 §5.2)", () => {
  it("has every wire status and nothing else", () => {
    expect(Object.keys(CYCLE_COUNT_TRANSITIONS)).toEqual([...CYCLE_COUNT_STATUSES]);
  });

  it("Planned → In Progress / Cancelled; In Progress → Completed / Cancelled", () => {
    expect(CYCLE_COUNT_TRANSITIONS.PLANNED).toEqual(["IN_PROGRESS", "CANCELLED"]);
    expect(CYCLE_COUNT_TRANSITIONS.IN_PROGRESS).toEqual(["COMPLETED", "CANCELLED"]);
  });

  it.each([CYCLE_COUNT_STATUS.COMPLETED, CYCLE_COUNT_STATUS.CANCELLED])(
    "%s is terminal: no transition, and no permission set can act on it except a recount of Completed",
    (status) => {
      expect(CYCLE_COUNT_TRANSITIONS[status]).toEqual([]);
      expect(isCycleCountOpen(status)).toBe(false);
      Object.values(roles).forEach((can) => expect(canCountCycleCount(status, can)).toBe(false));
    },
  );

  it("an unrecognised status is neither open nor actionable", () => {
    expect(isCycleCountOpen("ON_HOLD")).toBe(false);
    Object.values(roles).forEach((can) =>
      expect(allowedCycleCountActions("ON_HOLD", can)).toEqual([]),
    );
  });
});

describe("action gating by permission code, not by role name", () => {
  it.each([CYCLE_COUNT_STATUS.PLANNED, CYCLE_COUNT_STATUS.IN_PROGRESS])(
    "%s: the counter submits; the manager submits or cancels; read-only does nothing",
    (status) => {
      expect(allowedCycleCountActions(status, roles.counter)).toEqual([CYCLE_COUNT_ACTION.SUBMIT]);
      expect(allowedCycleCountActions(status, roles.manager)).toEqual([
        CYCLE_COUNT_ACTION.SUBMIT,
        CYCLE_COUNT_ACTION.CANCEL,
      ]);
      expect(allowedCycleCountActions(status, roles.readOnly)).toEqual([]);
      expect(allowedCycleCountActions(status, roles.none)).toEqual([]);
    },
  );

  it("only APPROVE sends a Completed sheet for recount; the counter cannot", () => {
    expect(allowedCycleCountActions("COMPLETED", roles.manager)).toEqual([
      CYCLE_COUNT_ACTION.RECOUNT,
    ]);
    expect(allowedCycleCountActions("COMPLETED", roles.counter)).toEqual([]);
    expect(allowedCycleCountActions("COMPLETED", roles.readOnly)).toEqual([]);
  });

  it("a Cancelled sheet shows no mutating action to anyone", () => {
    Object.values(roles).forEach((can) =>
      expect(allowedCycleCountActions("CANCELLED", can)).toEqual([]),
    );
  });

  it("counting needs UPDATE on an open sheet", () => {
    expect(canCountCycleCount("IN_PROGRESS", roles.counter)).toBe(true);
    expect(canCountCycleCount("PLANNED", roles.manager)).toBe(true);
    expect(canCountCycleCount("IN_PROGRESS", roles.readOnly)).toBe(false);
    // APPROVE alone does not let anyone count: counting is its own permission.
    expect(canCountCycleCount("IN_PROGRESS", granted(P.viewPage, P.read, P.approve))).toBe(false);
  });
});

describe("status display", () => {
  it.each([
    ["PLANNED", "Đã lập phiếu", "neutral"],
    ["IN_PROGRESS", "Đang đếm", "info"],
    ["COMPLETED", "Đã nộp", "positive"],
    ["CANCELLED", "Đã huỷ", "danger"],
  ] as const)("%s reads as %s with the %s tone", (status, label, tone) => {
    expect(statusLabelVi(status, "stock")).toBe(label);
    expect(toneOf(status)).toBe(tone);
  });
});
