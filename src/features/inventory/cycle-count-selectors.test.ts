import { describe, expect, it } from "vitest";

import {
  classifyCartonScan,
  countProgress,
  isFullyCounted,
  lineState,
  lineVariance,
  recountableLines,
  showsBooks,
} from "./cycle-count-selectors";
import { cycleCountLineFixture as line } from "./test-support";

const adjustment = (status: string) => ({
  id: crypto.randomUUID(),
  number: "ADJ-1",
  quantityDelta: -120,
  status,
});

describe("line state", () => {
  it("is pending until the backend states `found`, then present or missing", () => {
    expect(lineState(line())).toBe("pending");
    expect(lineState(line({ found: true }))).toBe("present");
    expect(lineState(line({ found: false }))).toBe("missing");
  });

  it("counts progress from the lines, not from a total the screen computes elsewhere", () => {
    expect(countProgress([line(), line({ found: true }), line({ found: false })])).toEqual({
      counted: 2,
      total: 3,
    });
    expect(countProgress([])).toEqual({ counted: 0, total: 0 });
  });

  it("a sheet is fully counted only when every line is counted — and an empty sheet is not", () => {
    expect(isFullyCounted([line({ found: true }), line({ found: false })])).toBe(true);
    expect(isFullyCounted([line({ found: true }), line()])).toBe(false);
    expect(isFullyCounted([])).toBe(false);
  });
});

describe("variance (docs 20 §4.2 c8)", () => {
  it("books it, did not find it = shortage; not booked, found = surplus; the same = none", () => {
    expect(lineVariance(line({ booked: true, found: false }))).toBe("shortage");
    expect(lineVariance(line({ booked: false, found: true }))).toBe("surplus");
    expect(lineVariance(line({ booked: true, found: true }))).toBe("none");
    expect(lineVariance(line({ booked: false, found: false }))).toBe("none");
  });

  it("is unknown to a counter on a blind count (BR-07) and to a line not counted yet", () => {
    expect(lineVariance(line({ found: false }))).toBeNull();
    expect(lineVariance(line({ booked: true }))).toBeNull();
    expect(showsBooks([line(), line({ found: true })])).toBe(false);
    expect(showsBooks([line({ booked: false })])).toBe(true);
  });
});

describe("recount (docs 20 §4.2 d11)", () => {
  it("offers only a line whose variance was rejected and nothing waits on", () => {
    const rejected = line({ adjustments: [adjustment("REJECTED")] });
    const posted = line({ adjustments: [adjustment("POSTED")] });
    const pending = line({ adjustments: [adjustment("PENDING_APPROVAL")] });
    const mixed = line({ adjustments: [adjustment("REJECTED"), adjustment("PENDING_APPROVAL")] });
    const sent = line({ adjustments: [adjustment("REJECTED")], recountRequired: true });
    expect(recountableLines([rejected, posted, pending, mixed, sent, line()])).toEqual([rejected]);
  });
});

describe("scan classification (docs 20 §4.2 b4–b5)", () => {
  const here = "HCM-A01-1-B";
  const lines = [
    line({ lpn: "LPN-1", locationCode: here }),
    line({ lpn: "LPN-2", locationCode: "HCM-A01-1-C" }),
  ];

  it("a carton on the sheet at the scanned bin is present — whatever the case or padding", () => {
    expect(classifyCartonScan(lines, " lpn-1 ", "hcm-a01-1-b")).toMatchObject({
      kind: "present",
      line: { lpn: "LPN-1" },
    });
  });

  it("a carton on the sheet but at another bin is reported, never counted", () => {
    expect(classifyCartonScan(lines, "LPN-2", here)).toMatchObject({
      kind: "wrong-location",
      line: { lpn: "LPN-2" },
    });
  });

  it("a carton the sheet does not list is an unexpected carton at the scanned bin", () => {
    expect(classifyCartonScan(lines, "LPN-9", here)).toEqual({ kind: "unexpected" });
    // A line with no LPN (a loose line of the history) never matches a scan.
    expect(classifyCartonScan([line({ lpn: null })], "LPN-1", here)).toEqual({
      kind: "unexpected",
    });
  });
});
