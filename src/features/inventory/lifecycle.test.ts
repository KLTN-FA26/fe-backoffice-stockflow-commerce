import { describe, expect, it } from "vitest";

import { STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUSES, STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { ADJUSTMENT_TRANSITIONS, allowedAdjustmentActions } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const { PENDING_APPROVAL } = STOCK_ADJUSTMENT_STATUS;

function granted(...codes: PermissionCode[]) {
  return (code: PermissionCode) => codes.includes(code);
}

const checkers = {
  none: granted(),
  approve: granted(INVENTORY_PERMISSIONS.adjustmentApprove),
  update: granted(INVENTORY_PERMISSIONS.stockUpdate),
  all: granted(
    INVENTORY_PERMISSIONS.adjustmentRead,
    INVENTORY_PERMISSIONS.adjustmentApprove,
    INVENTORY_PERMISSIONS.stockUpdate,
    INVENTORY_PERMISSIONS.movementRead,
  ),
};

describe("SCRUM-424 lifecycle, four eyes and permission codes", () => {
  it("covers every wire status", () => {
    expect(Object.keys(ADJUSTMENT_TRANSITIONS)).toEqual([...STOCK_ADJUSTMENT_STATUSES]);
  });

  it.each(STOCK_ADJUSTMENT_STATUSES.filter((status) => status !== PENDING_APPROVAL))(
    "%s is terminal for every permission set and actor",
    (status) => {
      expect(ADJUSTMENT_TRANSITIONS[status]).toEqual([]);
      Object.values(checkers).forEach((can) => {
        expect(allowedAdjustmentActions(status, can, "decider", "requester")).toEqual([]);
        expect(allowedAdjustmentActions(status, can, "requester", "requester")).toEqual([]);
      });
    },
  );

  it("APPROVE lets another user decide a pending request", () => {
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.approve, "decider", "requester"),
    ).toEqual([STOCK_ADJUSTMENT_ACTION.APPROVE, STOCK_ADJUSTMENT_ACTION.REJECT]);
  });

  it("without APPROVE nobody can decide", () => {
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.update, "decider", "requester"),
    ).toEqual([]);
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.none, "decider", "requester"),
    ).toEqual([]);
  });

  it("the requester cannot approve or reject their own request even with APPROVE", () => {
    const actions = allowedAdjustmentActions(
      PENDING_APPROVAL,
      checkers.all,
      "requester",
      "requester",
    );
    expect(actions).not.toContain(STOCK_ADJUSTMENT_ACTION.APPROVE);
    expect(actions).not.toContain(STOCK_ADJUSTMENT_ACTION.REJECT);
  });

  it("withdraw needs UPDATE and being the requester", () => {
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.update, "requester", "requester"),
    ).toEqual([STOCK_ADJUSTMENT_ACTION.WITHDRAW]);
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.approve, "requester", "requester"),
    ).toEqual([]);
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.update, "other", "requester"),
    ).toEqual([]);
  });

  it("missing actor gets no actions", () => {
    expect(
      allowedAdjustmentActions(PENDING_APPROVAL, checkers.all, undefined, "requester"),
    ).toEqual([]);
  });

  it("an unknown backend status offers no action even with every permission", () => {
    Object.values(checkers).forEach((can) => {
      expect(allowedAdjustmentActions("APPROVED", can, "decider", "requester")).toEqual([]);
      expect(allowedAdjustmentActions("APPROVED", can, "requester", "requester")).toEqual([]);
    });
  });
});
