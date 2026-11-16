import { describe, expect, it } from "vitest";

import { CYCLE_COUNT_ERROR_MESSAGES as M } from "@/constants/cycle-count";

import { ApiError } from "@/lib/api/error";

import { cycleCountActionError, isStaleCycleCountError } from "./cycle-count-errors";

const fail = (code: string, status = 409) =>
  new ApiError(status, code, "English backend prose", undefined, "trace-1");

describe("cycle count action errors", () => {
  it.each([
    ["CYCLE_COUNT_NOT_OPEN", M.notOpen],
    ["CYCLE_COUNT_NOT_ASSIGNEE", M.notAssignee],
    ["CYCLE_COUNT_LINE_COUNTED_BY_OTHER", M.countedByOther],
    ["CYCLE_COUNT_LINE_NOT_COUNTED", M.notCounted],
    ["CYCLE_COUNT_SLOT_BUSY", M.slotBusy],
    ["CYCLE_COUNT_STALE", M.stale],
    ["CYCLE_COUNT_TOO_LARGE", M.tooLarge],
    ["STOCK_PACKAGE_WRONG_LOCATION", M.wrongLocation],
    ["STOCK_PACKAGE_NOT_FOUND", M.cartonNotFound],
    ["CONFLICT", M.cannotCount],
    ["NOT_FOUND", M.notFound],
    ["OUT_OF_DATA_SCOPE", M.outOfScope],
    ["FORBIDDEN", M.forbidden],
    ["VALIDATION_FAILED", M.validation],
  ])("%s → a Vietnamese sentence, never the backend text", (code, text) => {
    const view = cycleCountActionError(fail(code));
    expect(view.detail).toBe(text);
    expect(view.detail).not.toContain("English");
    expect(view.traceId).toBe("trace-1");
  });

  // Docs 20 BR-07: the answer for a blind counter says nothing about where the books keep a carton.
  it("the wrong-location and cannot-count sentences give nothing of the books away", () => {
    for (const text of [M.wrongLocation, M.cannotCount, M.stale]) {
      expect(text).not.toMatch(/HCM|LPN-|Lost|In Stock|Consumed|sổ sách ghi/i);
    }
  });

  it("an unknown code falls back by HTTP status", () => {
    expect(cycleCountActionError(fail("SOMETHING_NEW", 500)).detail).toBeTruthy();
    expect(cycleCountActionError(new Error("boom")).detail).toBeTruthy();
  });

  it("reloads the sheet only for conflicts that mean the screen is behind the server", () => {
    expect(isStaleCycleCountError(fail("CYCLE_COUNT_NOT_OPEN"))).toBe(true);
    expect(isStaleCycleCountError(fail("CYCLE_COUNT_STALE"))).toBe(true);
    expect(isStaleCycleCountError(fail("CYCLE_COUNT_LINE_NOT_COUNTED"))).toBe(true);
    expect(isStaleCycleCountError(fail("CYCLE_COUNT_NOT_ASSIGNEE", 403))).toBe(false);
    expect(isStaleCycleCountError(new Error("x"))).toBe(false);
  });
});
