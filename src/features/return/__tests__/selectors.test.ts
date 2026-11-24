import { describe, expect, it } from "vitest";

import { isReturnOpen } from "../lifecycle";
import {
  claimedUnits,
  claimEvidence,
  custodyEvidence,
  openCaps,
  openLines,
  proposedValue,
  proposesNoRefund,
  refundableUnits,
  returnOutcome,
  scanProgress,
} from "../selectors";

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

  it("WF-05 BE-21 (as BE G4): goods back in the warehouse always count — even after expiry, rejection or a 0 refund", () => {
    const back = line({ approvedQuantity: 6, receivedQuantity: 5, refundQuantity: 0 });
    expect(claimedUnits(back, "RESOLVED")).toBe(5);
    expect(claimedUnits(back, "EXPIRED")).toBe(5);
    expect(claimedUnits(back, "CANCELLED")).toBe(5);
    expect(claimedUnits(back, "REJECTED")).toBe(5);
    expect(claimedUnits(line({ requestedQuantity: 2, receivedQuantity: 3 }), "REQUESTED")).toBe(3);
    // a status the FE does not know: the largest known count (stricter cap, BE re-checks)
    expect(claimedUnits(back, "UNKNOWN")).toBe(10);
  });
});

describe("WF-05 Q-4: refusal and outcome read by units, as the BE does", () => {
  const ret = (over: Record<string, unknown> = {}) => ({
    status: "RESOLVED" as const,
    outcome: null,
    refusalReason: null,
    resolution: null,
    lines: [line({ refundQuantity: 0 })],
    ...over,
  });

  it("a proposal of no unit is a refusal; a partial one with a reason still refunds", () => {
    expect(proposesNoRefund(ret())).toBe(true);
    expect(proposesNoRefund(ret({ lines: [line({ refundQuantity: 2 })] }))).toBe(false);
  });

  it("the BE outcome wins; an old BE: units refunded → REFUNDED, else REFUSED with a reason, else nothing to refund", () => {
    expect(returnOutcome(ret({ outcome: "REFUSED" }))).toBe("REFUSED");
    // units refunded worth 0 (nothing paid on the order) is still a refund
    expect(returnOutcome(ret({ lines: [line({ refundQuantity: 2, refundAmount: 0 })] }))).toBe(
      "REFUNDED",
    );
    expect(returnOutcome(ret({ refusalReason: "NOT_DEFECTIVE" }))).toBe("REFUSED");
    expect(returnOutcome(ret())).toBe("NOTHING_TO_REFUND");
    expect(returnOutcome(ret({ status: "SETTLEMENT_PENDING" }))).toBeNull();
  });
});

describe("WF-05 Q-11: custody notes are not claim photos", () => {
  it("splits the photos by stage", () => {
    const evidence = [
      { id: "a", stage: "CLAIM", uploadedAt: "2026-11-24T00:00:00Z" },
      { id: "b", stage: "CUSTODY", uploadedAt: "2026-11-24T00:00:00Z" },
    ];
    expect(claimEvidence({ evidence }).map((e) => e.id)).toEqual(["a"]);
    expect(custodyEvidence({ evidence }).map((e) => e.id)).toEqual(["b"]);
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

describe("openCaps per delivered shipment (WF-05 TH-1)", () => {
  const orderLines = [
    { lineId: "ol-1", sku: "SKU-1", deliveredQuantity: 30, customPrinted: false },
    { lineId: "ol-2", sku: "SKU-2", deliveredQuantity: 10, customPrinted: true },
  ];
  const s1 = { shipmentId: "s-1", lines: [{ lineId: "ol-1", quantity: 20 }] };
  const s2 = {
    shipmentId: "s-2",
    lines: [
      { lineId: "ol-1", quantity: 10 },
      { lineId: "ol-2", quantity: 10 },
    ],
  };

  it("caps a line at what its shipment delivered, minus that shipment's other returns", () => {
    const caps = openCaps(
      orderLines,
      [{ shipmentId: "s-1", status: "RESOLVED", lines: [line({ refundQuantity: 5 })] }],
      isReturnOpen,
      s1,
    );
    expect(caps.get("ol-1")).toBe(15);
  });

  it("an open return locks a line on its own shipment only", () => {
    const returns = [{ shipmentId: "s-1", status: "REQUESTED" as const, lines: [line()] }];
    expect(openCaps(orderLines, returns, isReturnOpen, s1).get("ol-1")).toBe(0);
    // Lô 2: 10 đã giao, phần lô 1 đang giữ (10) không trừ vào lô 2 nhưng trừ vào tổng (30 − 10 = 20)
    expect(openCaps(orderLines, returns, isReturnOpen, s2).get("ol-1")).toBe(10);
  });

  it("lists only the lines the shipment carried", () => {
    expect(openLines(orderLines, [], isReturnOpen, s1).map((l) => l.lineId)).toEqual(["ol-1"]);
    expect(openLines(orderLines, [], isReturnOpen, s2)).toEqual([
      { lineId: "ol-1", sku: "SKU-1", customPrinted: false, cap: 10 },
      { lineId: "ol-2", sku: "SKU-2", customPrinted: true, cap: 10 },
    ]);
    expect(openLines(orderLines, [], isReturnOpen, null)).toHaveLength(2);
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
