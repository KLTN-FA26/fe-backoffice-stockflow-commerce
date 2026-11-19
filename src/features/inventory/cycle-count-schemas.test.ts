import { describe, expect, it } from "vitest";

import { CYCLE_COUNT_STATUSES } from "@/constants/cycle-count";

import {
  addCountLineInput,
  cancelCycleCountInput,
  countLineInput,
  cycleCountDto,
  cycleCountListInput,
  cycleCountPageDto,
  planCycleCountInput,
  recountCycleCountInput,
  splitCodes,
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

describe("planCycleCountInput — PlanCycleCountRequest (docs 20 §4.2 a, BR-12)", () => {
  const WAREHOUSE = "d0000001-0000-4000-8000-0000000000c1";
  const base = {
    warehouseId: WAREHOUSE,
    blind: true,
    zoneIds: [],
    shelfCodes: [],
    locationCodes: [],
    skus: [],
  };

  it("needs at least one zone, shelf, bin or SKU: an empty scope would count the whole warehouse", () => {
    expect(planCycleCountInput.safeParse(base).success).toBe(false);
    expect(planCycleCountInput.safeParse({ ...base, shelfCodes: ["A01"] }).success).toBe(true);
    expect(planCycleCountInput.safeParse({ ...base, skus: ["MUG-RED"] }).success).toBe(true);
    expect(planCycleCountInput.safeParse({ ...base, zoneIds: [LINE] }).success).toBe(true);
  });

  it("keeps each list within the BE limits (50 zones, 200 shelves, 500 bins, 200 SKUs)", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`);
    expect(planCycleCountInput.safeParse({ ...base, shelfCodes: many(201) }).success).toBe(false);
    expect(planCycleCountInput.safeParse({ ...base, locationCodes: many(501) }).success).toBe(
      false,
    );
    expect(planCycleCountInput.safeParse({ ...base, locationCodes: many(500) }).success).toBe(true);
    expect(planCycleCountInput.safeParse({ ...base, skus: many(201) }).success).toBe(false);
    expect(planCycleCountInput.safeParse({ ...base, shelfCodes: ["S".repeat(21)] }).success).toBe(
      false,
    );
  });

  it("the day (YYYY-MM-DD) and the note (at most 500 characters) are optional", () => {
    const withSku = { ...base, skus: ["X"] };
    expect(
      planCycleCountInput.parse({ ...withSku, plannedDate: "2026-11-20", note: " cuối tháng " }),
    ).toMatchObject({
      plannedDate: "2026-11-20",
      note: "cuối tháng",
    });
    expect(planCycleCountInput.safeParse({ ...withSku, plannedDate: "20/11/2026" }).success).toBe(
      false,
    );
    expect(planCycleCountInput.safeParse({ ...withSku, note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(planCycleCountInput.parse(withSku)).not.toHaveProperty("plannedDate");
  });

  it("the counter is optional", () => {
    const parsed = planCycleCountInput.parse({ ...base, skus: ["X"], assignedUserId: LINE });
    expect(parsed.assignedUserId).toBe(LINE);
    expect(planCycleCountInput.parse({ ...base, skus: ["X"] }).assignedUserId).toBeUndefined();
  });

  it("splitCodes reads commas, semicolons and new lines, and drops blanks and repeats", () => {
    expect(splitCodes(" A01, A02;A03\nA01  \n")).toEqual(["A01", "A02", "A03"]);
    expect(splitCodes("")).toEqual([]);
  });

  it("contract with the BE's PlanCycleCountRequest: the four lists are one `scope` object, nothing else is nested", () => {
    const request = planCycleCountInput.parse({
      warehouseId: WAREHOUSE,
      blind: true,
      assignedUserId: LINE,
      plannedDate: "2026-11-20",
      note: "cuối tháng",
      zoneIds: [LINE],
      shelfCodes: ["A01"],
      locationCodes: ["HCM-A01-1-B"],
      skus: ["MUG-RED"],
    });
    expect(request).toEqual({
      warehouseId: WAREHOUSE,
      blind: true,
      assignedUserId: LINE,
      plannedDate: "2026-11-20",
      note: "cuối tháng",
      scope: {
        zoneIds: [LINE],
        shelfCodes: ["A01"],
        locationCodes: ["HCM-A01-1-B"],
        skus: ["MUG-RED"],
      },
    });
    expect(request).not.toHaveProperty("zoneIds");
    expect(request).not.toHaveProperty("skus");
  });
});
