import { describe, expect, it } from "vitest";

import { isReturnOpen } from "../lifecycle";
import { claimedUnits, openCaps, proposedValue, refundableUnits, scanProgress } from "../selectors";

import type { ReturnLine } from "../types";

const line = (over: Partial<ReturnLine> = {}): ReturnLine => ({
  id: "rl-1",
  orderLineId: "ol-1",
  sku: "SKU-1",
  customPrinted: false,
  unitPrice: 100,
  requestedQuantity: 10,
  refundQuantity: 0,
  ...over,
});

describe("claimedUnits (BE ReturnLine.claimedUnits)", () => {
  it("asked while requested, approved while open, refunded once resolved, nothing once closed", () => {
    const l = line({ approvedQuantity: 6, refundQuantity: 4 });
    expect(claimedUnits(l, "REQUESTED")).toBe(10);
    expect(claimedUnits(l, "AWAITING_RETURN")).toBe(6);
    expect(claimedUnits(l, "RESOLVED")).toBe(4);
    expect(claimedUnits(l, "REJECTED")).toBe(0);
  });
});

describe("openCaps", () => {
  it("delivered minus what other returns claim; a line with an open return is locked", () => {
    const caps = openCaps(
      [
        { lineId: "ol-1", deliveredQuantity: 24 },
        { lineId: "ol-2", deliveredQuantity: 12 },
      ],
      [
        { status: "RESOLVED", lines: [line({ orderLineId: "ol-1", refundQuantity: 5 })] },
        { status: "REQUESTED", lines: [line({ orderLineId: "ol-2", requestedQuantity: 2 })] },
      ],
      isReturnOpen,
    );
    expect(caps.get("ol-1")).toBe(19);
    expect(caps.get("ol-2")).toBe(0);
  });
});

describe("refund caps", () => {
  it("at most approved and back (BE refundableUnits)", () => {
    expect(refundableUnits(line({ approvedQuantity: 6, receivedQuantity: 4 }))).toBe(4);
    expect(refundableUnits(line({ approvedQuantity: 6 }))).toBe(0);
    expect(proposedValue([line({ unitPrice: 1000 })], new Map([["rl-1", 3]]))).toBe(3000);
  });
});

describe("scanProgress (docs 03 §4.2 step 11)", () => {
  it("counts scanned against what the source carried", () => {
    const progress = scanProgress({
      cartons: [{ lpn: "A", sku: "S", quantity: 1 }],
      expectedCartons: [
        { lpn: "A", sku: "S", quantity: 1, scanned: true },
        { lpn: "B", sku: "S", quantity: 1, scanned: false },
      ],
    });
    expect(progress).toMatchObject({ scanned: 1, expected: 2, extra: 0 });
    expect(progress.missing.map((c) => c.lpn)).toEqual(["B"]);
  });
});
