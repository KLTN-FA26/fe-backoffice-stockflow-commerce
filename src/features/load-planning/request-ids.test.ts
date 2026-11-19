import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCreatePlanRequestId,
  createPlanFingerprint,
  createPlanRequestId,
} from "./request-ids";

const intent = {
  warehouseId: "WH-HN-01",
  shipmentIds: ["s-2", "s-1"],
  vehicleTypeIds: ["t-1"],
  selectionMode: "SINGLE_TYPE" as const,
};

beforeEach(() => {
  clearCreatePlanRequestId();
  window.sessionStorage.clear();
});

describe("createPlanRequestId — idempotent create", () => {
  it("returns the same UUID for the same intent, so a retry replays the plan the BE already made", () => {
    const first = createPlanRequestId(createPlanFingerprint(intent));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(createPlanRequestId(createPlanFingerprint(intent))).toBe(first);
  });

  it("is stable across the order of shipments / vehicle types and a padded note", () => {
    const a = createPlanFingerprint({ ...intent, shipmentIds: ["s-1", "s-2"], note: " ghi chú " });
    const b = createPlanFingerprint({ ...intent, shipmentIds: ["s-2", "s-1"], note: "ghi chú" });
    expect(a).toBe(b);
  });

  it("issues a NEW id once the content changes (an old id would return the OLD plan)", () => {
    const first = createPlanRequestId(createPlanFingerprint(intent));
    const changed = createPlanRequestId(
      createPlanFingerprint({ ...intent, selectionMode: "FEWEST_VEHICLES" }),
    );
    expect(changed).not.toBe(first);
    const moved = createPlanRequestId(
      createPlanFingerprint({ ...intent, warehouseId: "WH-HCM-01" }),
    );
    expect(moved).not.toBe(changed);
  });

  it("forgets the id after a successful create: the next plan is a new one", () => {
    const first = createPlanRequestId(createPlanFingerprint(intent));
    clearCreatePlanRequestId();
    expect(createPlanRequestId(createPlanFingerprint(intent))).not.toBe(first);
  });

  it("still works when sessionStorage is blocked", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      const id = createPlanRequestId(createPlanFingerprint(intent));
      expect(createPlanRequestId(createPlanFingerprint(intent))).toBe(id);
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });
});
