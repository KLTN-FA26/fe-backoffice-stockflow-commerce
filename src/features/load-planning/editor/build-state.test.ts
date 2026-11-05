import { describe, expect, it } from "vitest";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";
import {
  planFixture,
  unplacedParcel,
  vehicleOfLayout,
  VEHICLE_TYPE_ID,
} from "../__fixtures__/plans";

import { buildEditorState } from "./build-state";

describe("buildEditorState", () => {
  it("builds vehicles from layouts and the tray from the plan's unplaced parcels, attaching the door by vehicle type", () => {
    const tray = unplacedParcel("TOO_LARGE");
    const base = planFixture();
    const plan = planFixture({ packages: [...base.packages, tray], unplacedCount: 1 });
    const door = { widthMm: 1200, heightMm: 1100 };
    const state = buildEditorState(plan, [LAYOUT_PICKUP_KIT], new Map([[VEHICLE_TYPE_ID, door]]));
    expect(state?.vehicles).toHaveLength(1);
    expect(state?.vehicles[0]).toMatchObject({ seq: 1, door, vehicleTypeId: VEHICLE_TYPE_ID });
    expect(state?.vehicles[0].boxes).toBe(LAYOUT_PICKUP_KIT.boxes);
    expect(state?.tray).toEqual([
      {
        ref: tray.packageId,
        sourceRef: null,
        label: tray.labelCode,
        partName: "Tủ vải",
        kitGroup: null,
        origMm: { l: 2600, w: 500, h: 500 },
        rotatable: true,
        weightKg: 30,
      },
    ]);
  });

  it("leaves the door unknown (null) when the vehicle type is not in the lookup", () => {
    expect(buildEditorState(planFixture(), [LAYOUT_PICKUP_KIT])?.vehicles[0].door).toBeNull();
  });

  it("returns null while the plan and the layouts disagree (a refetch is half done)", () => {
    const plan = planFixture();
    expect(buildEditorState(plan, [])).toBeNull();
    expect(buildEditorState(plan, [{ ...LAYOUT_PICKUP_KIT, code: "OTHER" }])).toBeNull();
    const fewer = { ...LAYOUT_PICKUP_KIT, boxes: LAYOUT_PICKUP_KIT.boxes.slice(1) };
    expect(buildEditorState(plan, [fewer])).toBeNull();
    const wrongVehicle = planFixture({
      packages: plan.packages.map((p, i) => (i === 0 ? { ...p, vehicleSeq: 2 } : p)),
    });
    expect(buildEditorState(wrongVehicle, [LAYOUT_PICKUP_KIT])).toBeNull();
  });

  it("works with several vehicles, each only its own boxes", () => {
    const second = {
      ...LAYOUT_PICKUP_KIT,
      seq: 2,
      boxes: LAYOUT_PICKUP_KIT.boxes.map((b) => ({ ...b, ref: `${b.ref}-2` })),
    };
    const first = planFixture();
    const plan = planFixture({
      vehicles: [vehicleOfLayout(LAYOUT_PICKUP_KIT), vehicleOfLayout(second)],
      packages: [
        ...first.packages,
        ...first.packages.map((p) => ({ ...p, packageId: `${p.packageId}-2`, vehicleSeq: 2 })),
      ],
    });
    const state = buildEditorState(plan, [LAYOUT_PICKUP_KIT, second]);
    expect(state?.vehicles.map((v) => v.boxes.length)).toEqual([
      LAYOUT_PICKUP_KIT.boxes.length,
      LAYOUT_PICKUP_KIT.boxes.length,
    ]);
    expect(state?.tray).toEqual([]);
  });
});
