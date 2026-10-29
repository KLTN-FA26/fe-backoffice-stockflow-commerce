import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_STATUSES,
} from "@/constants";

import {
  planFixture,
  planWithUnplaced,
  transferPlanFixture,
  transferPlanWithUnplaced,
  vehicleOfLayout,
} from "./__fixtures__/plans";
import { LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import { LOAD_PLAN_TRANSITIONS, loadPlanActions } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const P = LOAD_PLAN_PERMISSIONS;
const actor = (...codes: PermissionCode[]) => ({
  can: (code: PermissionCode) => codes.includes(code),
});
const worker = actor(P.viewPage, P.read, P.create, P.update);
const viewer = actor(P.viewPage, P.read);
const CONTROLLED = FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update;
const manager = actor(P.viewPage, P.read, P.create, P.update, CONTROLLED);

describe("LOAD_PLAN_TRANSITIONS (docs 09 §5, LoadPlan.requireStatus)", () => {
  it("terminal states have no way out", () => {
    expect(LOAD_PLAN_TRANSITIONS.DISPATCHED).toEqual([]);
    expect(LOAD_PLAN_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("covers every status", () => {
    expect(Object.keys(LOAD_PLAN_TRANSITIONS).sort()).toEqual([...LOAD_PLAN_STATUSES].sort());
  });
});

describe("loadPlanActions — permission gate", () => {
  it("creating needs :CREATE, not just :UPDATE", () => {
    expect(loadPlanActions(null, worker).create).toBe(true);
    expect(loadPlanActions(null, actor(P.viewPage, P.read, P.update)).create).toBe(false);
    expect(loadPlanActions(null, viewer).create).toBe(false);
  });

  it("without :UPDATE no step is allowed in any status", () => {
    for (const status of LOAD_PLAN_STATUSES) {
      const actions = loadPlanActions({ ...planWithUnplaced(), status }, viewer);
      expect(Object.values(actions).filter((value) => value === true)).toEqual([]);
    }
  });
});

describe("loadPlanActions — by status", () => {
  it("DRAFT: calculate, edit inputs and cancel; nothing else", () => {
    expect(loadPlanActions(planFixture({ status: "DRAFT", vehicles: [] }), worker)).toMatchObject({
      calculate: true,
      editInputs: true,
      cancel: true,
      recalculateVehicle: false,
      confirm: false,
      reopen: false,
      acknowledge: false,
    });
  });

  it("PLANNED: recalculate, edit inputs, confirm, cancel — reopen only exists after confirming", () => {
    expect(loadPlanActions(planFixture(), worker)).toMatchObject({
      calculate: true,
      editInputs: true,
      recalculateVehicle: true,
      confirm: true,
      cancel: true,
      reopen: false,
      confirmBlocked: null,
    });
  });

  it("CONFIRMED: reopen and cancel, the plan is locked otherwise", () => {
    expect(loadPlanActions(planFixture({ status: "CONFIRMED" }), worker)).toMatchObject({
      reopen: true,
      cancel: true,
      calculate: false,
      editInputs: false,
      recalculateVehicle: false,
      confirm: false,
    });
  });

  it("BR-14: once a vehicle's load is LOADING or DISPATCHED, reopen and cancel are gone", () => {
    for (const status of ["LOADING", "DISPATCHED"]) {
      const plan = planFixture({
        status: "CONFIRMED",
        vehicles: [
          vehicleOfLayout(LAYOUT_PICKUP_KIT, { load: { loadId: "l-1", code: "LD-1", status } }),
        ],
      });
      expect(loadPlanActions(plan, worker)).toMatchObject({ reopen: false, cancel: false });
    }
    const booked = planFixture({
      status: "CONFIRMED",
      vehicles: [
        vehicleOfLayout(LAYOUT_PICKUP_KIT, {
          load: { loadId: "l-1", code: "LD-1", status: "VEHICLE_BOOKED" },
        }),
      ],
    });
    expect(loadPlanActions(booked, worker)).toMatchObject({ reopen: true, cancel: true });
  });

  it("SCRUM-474 UNLOAD-DESIGN: the controlled cancel needs its own permission code and a CONFIRMED plan whose loading started", () => {
    const loading = (status: string) =>
      planFixture({
        status: "CONFIRMED",
        vehicles: [
          vehicleOfLayout(LAYOUT_PICKUP_KIT, { load: { loadId: "l-1", code: "LD-1", status } }),
        ],
      });
    // The manager (permission code, never a role) sees it once a vehicle loads; the plain cancel is gone then
    expect(loadPlanActions(loading("LOADING"), manager)).toMatchObject({
      cancelControlled: true,
      cancelControlledBlocked: null,
      cancel: false,
      reopen: false,
    });
    // Staff with :UPDATE but without the code never see it; neither does a viewer
    expect(loadPlanActions(loading("LOADING"), worker).cancelControlled).toBe(false);
    expect(loadPlanActions(loading("LOADING"), viewer).cancelControlled).toBe(false);
    // The code alone is enough to see it (BE checks only that code), without :UPDATE
    expect(
      loadPlanActions(loading("LOADING"), actor(P.viewPage, P.read, CONTROLLED)),
    ).toMatchObject({ cancelControlled: true, calculate: false, confirm: false });
    // Nothing loading yet: the plain cancel / reopen still serve, no controlled button
    const booked = planFixture({
      status: "CONFIRMED",
      vehicles: [
        vehicleOfLayout(LAYOUT_PICKUP_KIT, {
          load: { loadId: "l-1", code: "LD-1", status: "VEHICLE_BOOKED" },
        }),
      ],
    });
    expect(loadPlanActions(booked, manager)).toMatchObject({
      cancelControlled: false,
      cancel: true,
    });
    // Not CONFIRMED: never
    for (const status of ["DRAFT", "PLANNED", "DISPATCHED", "CANCELLED"] as const) {
      expect(loadPlanActions({ ...loading("LOADING"), status }, manager).cancelControlled).toBe(
        false,
      );
    }
  });

  it("UNLOAD-DESIGN point 3: a vehicle that already left blocks the whole-plan controlled cancel (per vehicle instead)", () => {
    const plan = planFixture({
      status: "CONFIRMED",
      vehicles: [
        vehicleOfLayout(LAYOUT_PICKUP_KIT, {
          load: { loadId: "l-1", code: "LD-1", status: "DISPATCHED" },
        }),
      ],
    });
    expect(loadPlanActions(plan, manager)).toMatchObject({
      cancelControlled: true,
      cancelControlledBlocked: "vehicleLeft",
    });
  });

  it("DISPATCHED and CANCELLED show no mutating button", () => {
    for (const status of ["DISPATCHED", "CANCELLED"] as const) {
      // `create` là quyền lập kế hoạch mới, không thuộc kế hoạch đang xem
      const { create: _create, ...actions } = loadPlanActions(planFixture({ status }), worker);
      expect(Object.values(actions).filter((value) => value === true)).toEqual([]);
    }
  });
});

describe("loadPlanActions — confirm is blocked with a reason (BR-13, needs recalculation)", () => {
  it("unplaced parcels must be acknowledged first, then the block lifts", () => {
    const pending = loadPlanActions(planWithUnplaced(), worker);
    expect(pending).toMatchObject({
      acknowledge: true,
      confirm: true,
      confirmBlocked: "unplacedPending",
    });
    const acknowledged = loadPlanActions(
      {
        ...planWithUnplaced(),
        unplacedAcknowledgement: { at: "2026-10-22T03:00:00Z", by: "u", note: null },
      },
      worker,
    );
    expect(acknowledged).toMatchObject({ acknowledge: false, confirmBlocked: null });
  });

  it("a vehicle flagged needsRecalculation blocks confirming (409 LOAD_PLAN_NEEDS_RECALCULATION at BE)", () => {
    const plan = planFixture({
      vehicles: [vehicleOfLayout(LAYOUT_PICKUP_KIT, { needsRecalculation: true })],
    });
    expect(loadPlanActions(plan, worker).confirmBlocked).toBe("needsRecalculation");
  });

  it("a plan without vehicles cannot be confirmed", () => {
    expect(loadPlanActions(planFixture({ vehicles: [] }), worker).confirmBlocked).toBe(
      "noVehicles",
    );
  });
});

describe("loadPlanActions — editPlacements (PR F5, BE LoadPlan.editPlacements)", () => {
  it("needs :UPDATE, a PLANNED plan and at least one vehicle", () => {
    expect(loadPlanActions(planFixture(), worker).editPlacements).toBe(true);
    expect(loadPlanActions(planFixture(), viewer).editPlacements).toBe(false);
    expect(loadPlanActions(planFixture(), actor(P.viewPage, P.read, P.create)).editPlacements).toBe(
      false,
    );
    expect(loadPlanActions(planFixture({ vehicles: [] }), worker).editPlacements).toBe(false);
  });

  it("is off in every other status, terminal ones included", () => {
    for (const status of LOAD_PLAN_STATUSES.filter((s) => s !== "PLANNED"))
      expect(loadPlanActions(planFixture({ status }), worker).editPlacements).toBe(false);
  });

  it("stays available while a vehicle needs recalculation (an edit clears the flag) and while parcels are unplaced", () => {
    const flagged = planFixture({
      vehicles: [vehicleOfLayout(LAYOUT_PICKUP_KIT, { needsRecalculation: true })],
    });
    expect(loadPlanActions(flagged, worker).editPlacements).toBe(true);
    expect(loadPlanActions(planWithUnplaced(), worker).editPlacements).toBe(true);
  });
});

describe("loadPlanActions — TRANSFER plan: the transfer order ships whole (BE requireTransferWhole)", () => {
  it("unplaced parcels: no acknowledge (nothing can be left behind) and confirm is blocked as 'transferShipsWhole'", () => {
    expect(loadPlanActions(transferPlanWithUnplaced(), worker)).toMatchObject({
      acknowledge: false,
      confirm: true,
      confirmBlocked: "transferShipsWhole",
    });
  });

  it("the same plan from an order source still offers the BR-13 acknowledgement", () => {
    expect(loadPlanActions(planWithUnplaced(), worker)).toMatchObject({
      acknowledge: true,
      confirmBlocked: "unplacedPending",
    });
  });

  it("everything placed: confirmable like any plan; the other steps follow the order plan table", () => {
    expect(loadPlanActions(transferPlanFixture(), worker)).toMatchObject({
      confirm: true,
      confirmBlocked: null,
      acknowledge: false,
      editInputs: true,
      calculate: true,
      cancel: true,
    });
    expect(loadPlanActions(transferPlanFixture({ status: "CONFIRMED" }), worker)).toMatchObject({
      reopen: true,
      cancel: true,
      confirm: false,
    });
  });

  it("without :UPDATE the transfer plan is read-only too", () => {
    const { create: _create, ...actions } = loadPlanActions(transferPlanWithUnplaced(), viewer);
    expect(Object.values(actions).filter((value) => value === true)).toEqual([]);
  });
});
