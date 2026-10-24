import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCreatePlanRequestId,
  createPlanFingerprint,
  createPlanRequestId,
} from "../../request-ids";
import { shipmentIdsToSend } from "./shipment-selection";

const rest = {
  warehouseId: "WH-HN-01",
  vehicleTypeIds: ["t-1"],
  selectionMode: "SINGLE_TYPE" as const,
  note: "",
};

beforeEach(() => {
  clearCreatePlanRequestId();
  window.sessionStorage.clear();
});

describe("shipmentIdsToSend", () => {
  it("normally drops shipments that are no longer candidates (another plan took them)", () => {
    expect(shipmentIdsToSend(["s-1", "s-2"], new Set(["s-1"]), rest)).toEqual(["s-1"]);
  });

  it("after a lost response (a requestId is remembered for this exact selection) it sends the WHOLE selection, so the BE replays the draft it already made", () => {
    // The first attempt created a DRAFT holding s-1 and s-2: they are not candidates any more
    createPlanRequestId(createPlanFingerprint({ ...rest, shipmentIds: ["s-1", "s-2"] }));
    expect(shipmentIdsToSend(["s-1", "s-2"], new Set(), rest)).toEqual(["s-1", "s-2"]);
  });

  it("a remembered requestId of a DIFFERENT selection does not switch the filter off", () => {
    createPlanRequestId(createPlanFingerprint({ ...rest, shipmentIds: ["s-1"] }));
    expect(shipmentIdsToSend(["s-1", "s-2"], new Set(["s-2"]), rest)).toEqual(["s-2"]);
  });

  it("once the create succeeded the remembered id is gone and filtering is back", () => {
    createPlanRequestId(createPlanFingerprint({ ...rest, shipmentIds: ["s-1"] }));
    clearCreatePlanRequestId();
    expect(shipmentIdsToSend(["s-1"], new Set(), rest)).toEqual([]);
  });
});
