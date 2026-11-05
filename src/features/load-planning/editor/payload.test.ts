import { describe, expect, it } from "vitest";

import { LOAD_PLAN_LIMITS } from "@/constants";

import { editorState, layoutOne, vehicleOf } from "../__fixtures__/editor";

import { applyEdit } from "./apply";
import { buildPlacementsPayload, exceedsPlacementLimits } from "./payload";

describe("buildPlacementsPayload (BE LoadPlacementsRequest)", () => {
  it("lists every vehicle and the tray, each parcel once, with the placed sizes and orientation", () => {
    const payload = buildPlacementsPayload(editorState(), 7);
    expect(payload).toEqual({
      expectedVersion: 7,
      vehicles: [
        {
          seq: 1,
          boxes: [
            {
              ref: "BOX-001",
              xMm: 0,
              yMm: 0,
              zMm: 0,
              wMm: 500,
              hMm: 300,
              dMm: 400,
              orientation: "LWH",
            },
            {
              ref: "BOX-002",
              xMm: 500,
              yMm: 0,
              zMm: 0,
              wMm: 500,
              hMm: 300,
              dMm: 400,
              orientation: "LWH",
            },
          ],
        },
        {
          seq: 2,
          boxes: [
            {
              ref: "FLAT-001",
              xMm: 0,
              yMm: 0,
              zMm: 0,
              wMm: 300,
              hMm: 300,
              dMm: 600,
              orientation: "LWH",
            },
          ],
        },
      ],
      tray: ["TRAY-1"],
    });
  });

  it("sends an emptied vehicle with no boxes (BE retires it) and the moved parcel on the tray", () => {
    let state = editorState();
    const emptied = applyEdit(state, { kind: "toTray", seq: 2, refs: ["FLAT-001"] });
    if (!emptied.ok) throw new Error("rejected");
    state = emptied.state;
    const payload = buildPlacementsPayload(state, 3);
    expect(payload.vehicles.find((v) => v.seq === 2)?.boxes).toEqual([]);
    expect(payload.tray).toEqual(["TRAY-1", "FLAT-001"]);
    const refs = [...payload.vehicles.flatMap((v) => v.boxes.map((b) => b.ref)), ...payload.tray];
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("rounds to whole millimetres as BE expects Integer fields", () => {
    const fractional = { ...layoutOne.boxes[0], xMm: 10.4, wMm: 499.6 };
    const state = editorState({ vehicles: [{ ...vehicleOf(layoutOne), boxes: [fractional] }] });
    expect(buildPlacementsPayload(state, 1).vehicles[0].boxes[0]).toMatchObject({
      xMm: 10,
      wMm: 500,
    });
  });

  it("does not send more boxes or vehicles than BE accepts", () => {
    expect(exceedsPlacementLimits(editorState())).toBe(false);
    const parcel = editorState().tray[0];
    const tray = Array.from({ length: LOAD_PLAN_LIMITS.placementBoxesMax + 1 }, (_, i) => ({
      ...parcel,
      ref: `t-${i}`,
    }));
    expect(exceedsPlacementLimits(editorState({ tray }))).toBe(true);
  });
});
