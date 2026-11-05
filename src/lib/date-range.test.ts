import { describe, expect, it } from "vitest";

import {
  activePreset,
  addDays,
  inclusiveDays,
  isValidIsoDay,
  presetRange,
  resolveRange,
  validateRange,
} from "./date-range";

describe("date range helpers (BE: ≤ 366 days, from ≤ to)", () => {
  it("counts days inclusively and adds days across month/year ends", () => {
    expect(inclusiveDays({ from: "2026-10-01", to: "2026-10-01" })).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects non-dates", () => {
    expect(isValidIsoDay("2026-02-31")).toBe(false);
    expect(isValidIsoDay("2026-10-1")).toBe(false);
    expect(isValidIsoDay("2026-10-01")).toBe(true);
  });

  it("validates the range", () => {
    expect(validateRange({ from: "2026-10-01", to: "2026-10-30" })).toBeNull();
    expect(validateRange({ from: "", to: "2026-10-30" })).toBe("invalid");
    expect(validateRange({ from: "2026-10-30", to: "2026-10-01" })).toBe("reversed");
    // 366 days inclusive is the limit
    expect(validateRange({ from: "2025-10-01", to: "2026-10-01" })).toBeNull();
    expect(validateRange({ from: "2025-09-30", to: "2026-10-01" })).toBe("tooLong");
  });

  it("presets end today and span the given number of days", () => {
    const range = presetRange(7, "2026-10-23");
    expect(range).toEqual({ from: "2026-10-17", to: "2026-10-23" });
    expect(inclusiveDays(range)).toBe(7);
    expect(activePreset(range, "2026-10-23")).toBe(7);
    expect(activePreset({ from: "2026-10-01", to: "2026-10-23" }, "2026-10-23")).toBeNull();
  });

  it("resolves a missing or invalid URL range to the 30-day default", () => {
    const fallback = presetRange(30, "2026-10-23");
    expect(resolveRange(null, null, "2026-10-23")).toEqual(fallback);
    expect(resolveRange("2026-10-30", "2026-10-01", "2026-10-23")).toEqual(fallback);
    expect(resolveRange("2026-10-01", "2026-10-05", "2026-10-23")).toEqual({
      from: "2026-10-01",
      to: "2026-10-05",
    });
  });
});
