import { describe, expect, it } from "vitest";

import { STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES, STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import {
  ADJUSTMENT_TRANSITIONS,
  allowedAdjustmentActions,
  canRequestAdjustment,
} from "./lifecycle";

import type { RoleName } from "@/lib/auth/roles";

const roles: RoleName[] = [
  "Warehouse Staff",
  "Warehouse Manager",
  "Inventory Planner",
  "System Admin",
];

describe("SCRUM-424 lifecycle and four eyes", () => {
  it("covers every wire status", () => {
    expect(Object.keys(ADJUSTMENT_TRANSITIONS)).toEqual([...STOCK_ADJUSTMENT_STATUSES]);
  });

  it.each(
    STOCK_ADJUSTMENT_STATUSES.filter(
      (status) => status !== STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
    ),
  )("%s is terminal for every role", (status) => {
    expect(ADJUSTMENT_TRANSITIONS[status]).toEqual([]);
    roles.forEach((role) =>
      expect(allowedAdjustmentActions(status, [role], "decider", "requester")).toEqual([]),
    );
  });

  it.each<RoleName>(["Warehouse Manager", "System Admin"])(
    "%s can decide another request",
    (role) => {
      expect(
        allowedAdjustmentActions(
          STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
          [role],
          "decider",
          "requester",
        ),
      ).toEqual([STOCK_ADJUSTMENT_ACTION.APPROVE, STOCK_ADJUSTMENT_ACTION.REJECT]);
    },
  );

  it.each(roles)("%s cannot approve their own request", (role) => {
    expect(
      allowedAdjustmentActions(
        STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        [role],
        "requester",
        "requester",
      ),
    ).not.toContain(STOCK_ADJUSTMENT_ACTION.APPROVE);
  });

  it("staff may withdraw only their own pending request", () => {
    expect(
      allowedAdjustmentActions(
        STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        ["Warehouse Staff"],
        "requester",
        "requester",
      ),
    ).toEqual([STOCK_ADJUSTMENT_ACTION.WITHDRAW]);
    expect(
      allowedAdjustmentActions(
        STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        ["Warehouse Staff"],
        "other",
        "requester",
      ),
    ).toEqual([]);
  });

  it("planner cannot create or decide requests", () => {
    expect(canRequestAdjustment(["Inventory Planner"])).toBe(false);
    expect(
      allowedAdjustmentActions(
        STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        ["Inventory Planner"],
        "other",
        "requester",
      ),
    ).toEqual([]);
  });

  it("missing actor gets no actions", () => {
    expect(
      allowedAdjustmentActions(
        STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        ["System Admin"],
        undefined,
        "requester",
      ),
    ).toEqual([]);
  });

  it("an unknown backend status offers no action to any actor", () => {
    roles.forEach((role) => {
      expect(allowedAdjustmentActions("APPROVED", [role], "decider", "requester")).toEqual([]);
      expect(allowedAdjustmentActions("APPROVED", [role], "requester", "requester")).toEqual([]);
    });
  });
});
