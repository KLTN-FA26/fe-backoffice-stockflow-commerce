import { describe, expect, it } from "vitest";

import { LOAD_PLAN_STATUSES } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import {
  candidateFixture,
  planFixture,
  planWithUnplaced,
  unplacedParcel,
} from "./__fixtures__/plans";
import { buildItemTable } from "./lib/item-rows";
import {
  isFinalLoadPlan,
  layoutsForItemTable,
  loadPlanStatusTone,
  pickedOnTray,
  summarizePlan,
  totalsOf,
  unplacedLinesOf,
  unplacedParcels,
  vehiclesNeedingRecalculation,
  fillLineOptions,
  fillLinesToSend,
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
      {
        label: "",
        partName: "Standee quảng cáo",
        origMm: { l: 2600, w: 500, h: 500 },
        quantity: 2,
      },
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
        ["Khay giấy", 4],
        ["Ống ly giấy", 16],
        ["Thùng ống hút", 3],
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

describe("fillLineOptions / fillLinesToSend — hàng chèn theo dòng đơn (RTM-LPGROUP)", () => {
  const candidate = (shipmentId: string, code: string, lines: (string | null)[]) => ({
    shipmentId,
    code,
    packages: lines.map((line, i) => ({
      ...candidateFixture().packages[0],
      packageId: `${shipmentId}-${i}`,
      orderLineId: line,
      partName: `SKU-${line}`,
    })),
  });

  it("lists each order line of the chosen shipments once, with its parcel count; unknown lines are skipped", () => {
    const options = fillLineOptions(
      [candidate("s1", "S1", ["A", "A", "B", null]), candidate("s2", "S2", ["C"])],
      new Set(["s1"]),
    );
    expect(options).toEqual([
      { orderLineId: "A", shipmentCode: "S1", sku: "SKU-A", packages: 2 },
      { orderLineId: "B", shipmentCode: "S1", sku: "SKU-B", packages: 1 },
    ]);
  });

  it("sends the ticked lines of the chosen shipments with PRIORITY_FILL only", () => {
    const options = fillLineOptions([candidate("s1", "S1", ["A", "B"])], new Set(["s1"]));
    expect(fillLinesToSend("PRIORITY_FILL", new Set(["B", "GONE"]), options)).toEqual(["B"]);
    expect(fillLinesToSend("PRIORITY_FILL", new Set(), options)).toEqual([]);
    expect(fillLinesToSend("SINGLE_TYPE", new Set(["B"]), options)).toBeUndefined();
  });
});
