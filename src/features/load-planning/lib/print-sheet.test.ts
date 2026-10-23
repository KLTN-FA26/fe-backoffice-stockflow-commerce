import { describe, expect, it } from "vitest";

import { gridBlock, makeLayout } from "../__fixtures__/build";
import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";
import { LAYOUT_UNIQUE_LABELS } from "../__fixtures__/layouts-real-labels";
import {
  TRANSFER_NUMBER,
  parcelsOfLayout,
  planFixture,
  planWithUnplaced,
  transferPlanFixture,
} from "../__fixtures__/plans";

import { letterFor, orientationText } from "./print-labels";
import { buildPrintSheet } from "./print-sheet";

import type { CartonType } from "../__fixtures__/build";
import type { PlanDetail } from "../plan-types";

const SHELF: CartonType = {
  ref: "S",
  label: "KS",
  partName: "Kệ sách",
  source: "package",
  origMm: { l: 1200, w: 300, h: 1800 },
  weightKg: 22,
};

describe("buildPrintSheet", () => {
  it("returns null for a vehicle the plan or the layouts do not have", () => {
    expect(buildPrintSheet(planFixture(), [LAYOUT_PICKUP_KIT], 7)).toBeNull();
    expect(buildPrintSheet(planFixture(), [], 1)).toBeNull();
  });

  it("turns the loading steps into rows: one step per block, every parcel of the vehicle exactly once", () => {
    const sheet = buildPrintSheet(planFixture(), [LAYOUT_PICKUP_KIT], 1);
    expect(sheet).not.toBeNull();
    expect(sheet?.steps.map((s) => `${s.seq}/${s.total} ${s.partName} x${s.count}`)).toEqual([
      "1/3 Mặt bàn x4",
      "2/3 Chân bàn x16",
      "3/3 Ghế bar x3",
    ]);
    expect(sheet?.steps.map((s) => s.parcels.length)).toEqual([4, 16, 3]);
    expect(sheet?.parcels).toHaveLength(LAYOUT_PICKUP_KIT.boxes.length);
    expect(new Set(sheet?.parcels.map((p) => p.ref)).size).toBe(LAYOUT_PICKUP_KIT.boxes.length);
    expect(sheet?.parcels.every((p, i, all) => i === 0 || p.step >= all[i - 1].step)).toBe(true);
  });

  it("joins each box to its parcel: label code, order number, size, weight; block size and position in cm", () => {
    const sheet = buildPrintSheet(planFixture(), [LAYOUT_PICKUP_KIT], 1);
    const first = sheet?.steps[0];
    expect(first?.parcels[0]).toMatchObject({
      step: 1,
      labelCode: "PKG-1",
      orderNo: "SO-20261004-000001",
      partName: "Mặt bàn",
      weightKg: expect.any(Number),
    });
    // z / x / y of the block corner, and depth × width × height of the block
    expect(first?.positionCm).toBe("0 / 0 / 0");
    expect(first?.blockCm).toMatch(/^\d+(,\d+)?×\d+(,\d+)?×\d+(,\d+)?$/);
  });

  it("shows 'Bộ x/N' for kit parts and 'Thuộc bộ' when only the group is known", () => {
    const plan = planFixture();
    const packages = plan.packages.map((p, i) =>
      i === 0 ? { ...p, kitPartNo: 2, kitPartCount: 5 } : p,
    );
    const sheet = buildPrintSheet({ ...plan, packages }, [LAYOUT_PICKUP_KIT], 1);
    const byRef = new Map(sheet?.parcels.map((p) => [p.ref, p]));
    expect(byRef.get(packages[0].packageId)?.kit).toBe("Bộ 2/5");
    const grouped = sheet?.parcels.filter((p) => p.kit === "Thuộc bộ") ?? [];
    expect(grouped.length).toBeGreaterThan(0);
    expect(sheet?.parcels.some((p) => p.kit === null)).toBe(true);
  });

  it("falls back to the shipment code when the order number is missing, and to the box label without a parcel", () => {
    const plan = planFixture();
    const noOrder: PlanDetail = {
      ...plan,
      shipments: plan.shipments.map((s) => ({ ...s, orderNumber: null })),
    };
    expect(buildPrintSheet(noOrder, [LAYOUT_PICKUP_KIT], 1)?.parcels[0].orderNo).toBe(
      "SO-20261004-000001-S1",
    );
    const orphan = buildPrintSheet({ ...plan, packages: [] }, [LAYOUT_PICKUP_KIT], 1);
    expect(orphan?.parcels[0]).toMatchObject({ orderNo: null, labelCode: expect.any(String) });
  });

  it("describes the orientation: untouched, or which side lies along the truck", () => {
    expect(orientationText("LWH")).toBe("Giữ nguyên");
    expect(orientationText("WLH")).toBe("Xoay: R dọc xe, D ngang xe, C đứng");
    const layout = makeLayout({
      seq: 1,
      code: "T",
      innerMm: { l: 4000, w: 2000, h: 2000 },
      maxPayloadKg: 500,
      boxes: gridBlock({
        carton: SHELF,
        orientation: "WLH",
        origin: { xMm: 0, yMm: 0, zMm: 0 },
        counts: { nx: 2, ny: 1, nz: 1 },
      }),
    });
    const plan = planFixture({ vehicles: [], packages: parcelsOfLayout(layout) });
    const sheet = buildPrintSheet(
      { ...plan, vehicles: [{ ...planFixture().vehicles[0], seq: 1 }] },
      [layout],
      1,
    );
    expect(sheet?.parcels.map((p) => p.orientation)).toEqual([
      "Xoay: R dọc xe, D ngang xe, C đứng",
      "Xoay: R dọc xe, D ngang xe, C đứng",
    ]);
  });

  it("builds the contents lines with a stable letter per item and correct totals", () => {
    const sheet = buildPrintSheet(planFixture(), [LAYOUT_PICKUP_KIT], 1);
    expect(sheet?.lines.map((l) => [l.letter, l.partName, l.pieces])).toEqual([
      ["A", "Chân bàn", 16],
      ["B", "Ghế bar", 3],
      ["C", "Mặt bàn", 4],
    ]);
    expect(sheet?.lines.reduce((n, l) => n + l.pieces, 0)).toBe(23);
    expect(sheet?.totalWeightKg).toBeCloseTo(LAYOUT_PICKUP_KIT.usedWeightKg, 1);
    expect(sheet?.steps[0].letter).toBe("C");
  });

  it("keeps the letters of an item the same on every vehicle of the plan", () => {
    const other = makeLayout({
      seq: 2,
      code: "T",
      innerMm: { l: 4000, w: 2000, h: 2000 },
      maxPayloadKg: 500,
      boxes: gridBlock({
        carton: { ...SHELF, partName: "Ấm chén" },
        origin: { xMm: 0, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
    });
    const plan = planFixture({
      vehicles: [planFixture().vehicles[0], { ...planFixture().vehicles[0], seq: 2 }],
    });
    const sheet = buildPrintSheet(plan, [LAYOUT_PICKUP_KIT, other], 1);
    // "Ấm chén" sorts first across the whole plan, so the items of vehicle 1 shift by one letter
    expect(sheet?.lines.map((l) => l.letter)).toEqual(["B", "C", "D"]);
  });

  it("has no unplaced note when everything is on a vehicle, and summarises the tray otherwise", () => {
    expect(buildPrintSheet(planFixture(), [LAYOUT_PICKUP_KIT], 1)?.unplaced).toBeNull();
    const sheet = buildPrintSheet(planWithUnplaced("TOO_LARGE"), [LAYOUT_PICKUP_KIT], 1);
    expect(sheet?.unplaced).toMatchObject({
      count: 1,
      acknowledged: false,
      reasons: ["TOO_LARGE"],
      lines: [{ partName: "Tủ vải", quantity: 1 }],
    });
    const acknowledged = planWithUnplaced();
    const ack = buildPrintSheet(
      {
        ...acknowledged,
        unplacedAcknowledgement: { at: "2026-10-22T03:00:00Z", by: "u", note: null },
      },
      [LAYOUT_PICKUP_KIT],
      1,
    );
    expect(ack?.unplaced?.acknowledged).toBe(true);
  });

  it("lists only the boxes of the vehicle layout", () => {
    const plan = planFixture();
    const sheet = buildPrintSheet(
      plan,
      [{ ...LAYOUT_PICKUP_KIT, boxes: LAYOUT_PICKUP_KIT.boxes.slice(0, 4) }],
      1,
    );
    expect(sheet?.parcels).toHaveLength(4);
  });
});

describe("buildPrintSheet — real BE labels", () => {
  it("prints 8 parcels with unique labels as 2 steps (2 pages), listing every label once", () => {
    const plan = planFixture({
      vehicles: [planFixture().vehicles[0]],
      packages: parcelsOfLayout(LAYOUT_UNIQUE_LABELS),
    });
    const sheet = buildPrintSheet(plan, [LAYOUT_UNIQUE_LABELS], 1);
    expect(sheet?.steps.map((s) => s.parcels.length)).toEqual([6, 2]);
    expect(sheet?.parcels).toHaveLength(8);
    expect(sheet?.lines.map((l) => [l.partName, l.pieces])).toEqual([
      ["SKU-CHAIR-02", 2],
      ["SKU-TABLE-01", 6],
    ]);
  });
});

describe("letterFor", () => {
  it("runs A..Z then AA, AB so letters stay unique past 26 items", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(letterFor)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});

describe("buildPrintSheet — kế hoạch nguồn TRANSFER (BE PR #164)", () => {
  it("kiện của lệnh chuyển kho in số lệnh ở cột đơn (không có lô giao để tra)", () => {
    const sheet = buildPrintSheet(transferPlanFixture(), [LAYOUT_PICKUP_KIT], 1);
    expect(sheet).not.toBeNull();
    expect(sheet?.parcels).toHaveLength(LAYOUT_PICKUP_KIT.boxes.length);
    expect(sheet?.parcels.every((p) => p.orderNo === TRANSFER_NUMBER)).toBe(true);
  });
});
