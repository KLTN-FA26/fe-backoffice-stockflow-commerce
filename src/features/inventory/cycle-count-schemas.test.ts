import { describe, expect, it } from "vitest";

import { CYCLE_COUNT_STATUSES } from "@/constants/cycle-count";

import {
  addCountLineInput,
  cancelCycleCountInput,
  countLineInput,
  cycleCountDto,
  cycleCountListInput,
  cycleCountPageDto,
  recountCycleCountInput,
} from "./cycle-count-schemas";
import { cycleCountFixture, cycleCountLineFixture, cycleCountSummaryFixture } from "./test-support";

const LINE = "d0000001-0000-4000-8000-0000000000b1";

describe("cycle count response contract (backend develop df34c338)", () => {
  it("accepts what a counter on a blind count receives: no books, no note, no adjustments", () => {
    const parsed = cycleCountDto.parse(cycleCountFixture({ blind: true }));
    expect(parsed.note).toBeUndefined();
    expect(parsed.lines[0]?.booked).toBeUndefined();
    expect(parsed.lines[0]?.adjustments).toBeUndefined();
    // A line not counted yet has no `found`: it is not "false".
    expect(parsed.lines[0]?.found).toBeUndefined();
  });

  it("reads the books, the counter and the variance adjustments an approver receives", () => {
    const parsed = cycleCountDto.parse(
      cycleCountFixture({
        status: "COMPLETED",
        note: "Báo thiếu thùng",
        lines: [
          cycleCountLineFixture({
            id: LINE,
            booked: true,
            found: false,
            countedBy: "d0000001-0000-4000-8000-0000000000c1",
            countedAt: "2026-11-12T02:00:00Z",
            adjustments: [
              {
                id: "d0000001-0000-4000-8000-0000000000d1",
                number: "ADJ-20261112-0001",
                quantityDelta: -120,
                status: "PENDING_APPROVAL",
              },
            ],
          }),
        ],
      }),
    );
    expect(parsed.lines[0]).toMatchObject({ booked: true, found: false });
    expect(parsed.lines[0]?.adjustments?.[0]).toMatchObject({ quantityDelta: -120 });
  });

  it("keeps an unknown status and source verbatim so one newer code does not hide a whole page", () => {
    const page = {
      items: [
        cycleCountSummaryFixture(),
        cycleCountSummaryFixture({ status: "ON_HOLD", triggerType: "FUTURE_SOURCE" }),
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    };
    const parsed = cycleCountPageDto.parse(page);
    expect(parsed.items.map((item) => item.status)).toEqual(["PLANNED", "ON_HOLD"]);
  });

  it("a summary carries no varianceCount for a counter", () => {
    expect(cycleCountSummaryFixture().varianceCount).toBeUndefined();
    expect(cycleCountSummaryFixture({ varianceCount: 2 }).varianceCount).toBe(2);
  });
});

describe("cycle count request contracts", () => {
  it("lists by the four docs 20 §5.2 statuses only", () => {
    expect(CYCLE_COUNT_STATUSES).toEqual(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
    CYCLE_COUNT_STATUSES.forEach((status) =>
      expect(cycleCountListInput.safeParse({ page: 0, size: 20, status }).success).toBe(true),
    );
    expect(cycleCountListInput.safeParse({ page: 0, size: 20, status: "OPEN" }).success).toBe(
      false,
    );
  });

  it("counting a line states present or not found — never a number of units (docs 20 BR-14)", () => {
    expect(countLineInput.parse({ found: true })).toEqual({ found: true });
    expect(countLineInput.parse({ found: false, countedQty: 7 })).toEqual({ found: false });
    expect(countLineInput.safeParse({}).success).toBe(false);
    expect(countLineInput.safeParse({ found: "yes" }).success).toBe(false);
  });

  it("adding a carton the plan did not list needs its bin and its LPN, both upper-cased", () => {
    expect(addCountLineInput.parse({ locationCode: " hcm-a01-2-a ", lpn: " lpn-1 " })).toEqual({
      locationCode: "HCM-A01-2-A",
      lpn: "LPN-1",
    });
    expect(addCountLineInput.safeParse({ locationCode: "HCM-A01-2-A", lpn: " " }).success).toBe(
      false,
    );
    expect(addCountLineInput.safeParse({ locationCode: " ", lpn: "LPN-1" }).success).toBe(false);
    expect(
      addCountLineInput.safeParse({ locationCode: "HCM-A01-2-A", lpn: "L".repeat(31) }).success,
    ).toBe(false);
  });

  it("cancelling needs a reason of at most 500 characters", () => {
    expect(cancelCycleCountInput.safeParse({ reason: " " }).success).toBe(false);
    expect(cancelCycleCountInput.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(cancelCycleCountInput.parse({ reason: " Kiểm lại " })).toEqual({ reason: "Kiểm lại" });
  });

  it("a recount names at least one line and keeps the note short", () => {
    expect(recountCycleCountInput.safeParse({ lineIds: [] }).success).toBe(false);
    expect(
      recountCycleCountInput.safeParse({ lineIds: [LINE], note: "x".repeat(501) }).success,
    ).toBe(false);
    expect(recountCycleCountInput.parse({ lineIds: [LINE], note: " nghi đếm sai " })).toEqual({
      lineIds: [LINE],
      note: "nghi đếm sai",
    });
  });
});
