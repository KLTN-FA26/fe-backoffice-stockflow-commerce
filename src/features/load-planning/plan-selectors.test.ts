import { describe, expect, it } from "vitest";

import { LOAD_PLAN_STATUSES } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import {
  planFixture,
  planWithUnplaced,
  transferCandidateFixture,
  transferPlanFixture,
  unplacedParcel,
} from "./__fixtures__/plans";
import { buildItemTable } from "./lib/item-rows";
import {
  candidateKey,
  isFinalLoadPlan,
  isTransferPlan,
  layoutsForItemTable,
  loadPlanStatusTone,
  pickedOnTray,
  summarizePlan,
  totalsOf,
  unplacedLinesOf,
  unplacedParcels,
  vehiclesNeedingRecalculation,
} from "./plan-selectors";

describe("status helpers", () => {
  it("gives every status a tone and only DISPATCHED / CANCELLED are final", () => {
    for (const status of LOAD_PLAN_STATUSES) expect(loadPlanStatusTone(status)).toBeTruthy();
    expect(LOAD_PLAN_STATUSES.filter(isFinalLoadPlan)).toEqual(["DISPATCHED", "CANCELLED"]);
  });
});

describe("unplaced tray", () => {
  it("lists only parcels without a vehicle", () => {
    const plan = planWithUnplaced("NO_SPACE");
    expect(unplacedParcels(plan)).toHaveLength(1);
    expect(unplacedParcels(plan)[0].unplacedReason).toBe("NO_SPACE");
    expect(unplacedParcels(planFixture())).toEqual([]);
  });

  it("groups the tray by SKU and size so the item table shows one line per kind", () => {
    const lines = unplacedLinesOf([unplacedParcel("TOO_LARGE", 1), unplacedParcel("TOO_LARGE", 2)]);
    expect(lines).toEqual([
      { label: "", partName: "Tủ vải", origMm: { l: 2600, w: 500, h: 500 }, quantity: 2 },
    ]);
  });
});

describe("item table over BE layouts (label = parcel label code)", () => {
  it("without normalising, every parcel is its own row; with it, rows group by SKU + size", () => {
    const perLabel = LAYOUT_PICKUP_KIT.boxes.map((box, i) => ({ ...box, label: `PKG-${i}` }));
    const layout = { ...LAYOUT_PICKUP_KIT, boxes: perLabel };
    expect(buildItemTable([layout]).rows.length).toBe(perLabel.length);
    const grouped = buildItemTable(layoutsForItemTable([layout]));
    expect(grouped.rows.map((row) => [row.partName, row.loaded])).toEqual(
      expect.arrayContaining([
        ["Mặt bàn", 4],
        ["Chân bàn", 16],
        ["Ghế bar", 3],
      ]),
    );
    expect(grouped.grandTotal).toBe(perLabel.length);
  });
});

describe("summaries", () => {
  it("summarizes layouts and carries the unplaced count the BE reports", () => {
    const summary = summarizePlan([LAYOUT_PICKUP_KIT], planWithUnplaced());
    expect(summary).toMatchObject({
      vehicles: 1,
      unplacedPieces: 1,
      pieces: LAYOUT_PICKUP_KIT.boxes.length,
    });
  });

  it("lists the vehicles that need recalculating", () => {
    const [vehicle] = planFixture().vehicles;
    expect(
      vehiclesNeedingRecalculation({
        vehicles: [vehicle, { ...vehicle, seq: 2, needsRecalculation: true }],
      }),
    ).toEqual([2]);
  });

  it("totals the selected shipments, leaving out parcels another plan holds", () => {
    const candidates = [
      { shipmentId: "a", packageCount: 10, packagesInOtherPlans: 2 },
      { shipmentId: "b", packageCount: 5, packagesInOtherPlans: 0 },
    ];
    expect(totalsOf(candidates, new Set(["a"]))).toEqual({ shipments: 1, packages: 8 });
    expect(totalsOf(candidates, new Set(["a", "b", "zzz"]))).toEqual({
      shipments: 2,
      packages: 13,
    });
    expect(totalsOf(candidates, new Set())).toEqual({ shipments: 0, packages: 0 });
  });
});

describe("pickedOnTray", () => {
  it("drops ticked parcels that left the tray, so they are never sent as addPackageIds", () => {
    const tray = [unplacedParcel("NO_SPACE", 1), unplacedParcel("NO_SPACE", 2)];
    const picked = new Set(["unplaced-NO_SPACE-1", "unplaced-NO_SPACE-9"]);
    expect([...pickedOnTray(picked, tray)]).toEqual(["unplaced-NO_SPACE-1"]);
    expect(pickedOnTray(picked, []).size).toBe(0);
    expect(pickedOnTray(new Set(), tray).size).toBe(0);
  });
});

describe("TRANSFER source (BE PR #164)", () => {
  it("isTransferPlan: by sourceType or by the transfer order; an order plan is not", () => {
    expect(isTransferPlan(transferPlanFixture())).toBe(true);
    expect(isTransferPlan({ sourceType: "TRANSFER", transferOrder: undefined })).toBe(true);
    expect(
      isTransferPlan({ sourceType: undefined, transferOrder: transferPlanFixture().transferOrder }),
    ).toBe(true);
    expect(isTransferPlan(planFixture())).toBe(false);
    expect(isTransferPlan({ sourceType: "ORDER" })).toBe(false);
  });

  it("candidateKey: the shipment id for an order candidate, the transfer order id for a transfer one", () => {
    expect(candidateKey({ shipmentId: "s-1" })).toBe("s-1");
    expect(candidateKey(transferCandidateFixture())).toBe(
      transferCandidateFixture().transferOrderId,
    );
    expect(candidateKey({})).toBe("");
  });

  it("totalsOf counts a selected transfer candidate through its transfer order id", () => {
    const candidate = transferCandidateFixture({ packageCount: 5, packagesInOtherPlans: 1 });
    expect(totalsOf([candidate], new Set([candidateKey(candidate)]))).toEqual({
      shipments: 1,
      packages: 4,
    });
    expect(totalsOf([candidate], new Set())).toEqual({ shipments: 0, packages: 0 });
  });
});
