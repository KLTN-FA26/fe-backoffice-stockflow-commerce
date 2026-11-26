import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  dayOfLocal,
  isoToDateText,
  localToDateTimeText,
  maskDateInput,
  maskDateTimeInput,
  maskTimeInput,
  parseDateInput,
  parseDateTimeInput,
  parseTimeInput,
  timeOfLocal,
  toLocalDateTime,
  todayAt,
  todayIso,
} from "./date-input";

describe("typed date input", () => {
  it("adds slashes while the digits arrive", () => {
    expect(maskDateInput("2")).toBe("2");
    expect(maskDateInput("25")).toBe("25");
    expect(maskDateInput("251")).toBe("25/1");
    expect(maskDateInput("2511")).toBe("25/11");
    expect(maskDateInput("25112026")).toBe("25/11/2026");
    expect(maskDateInput("25/11/2026999")).toBe("25/11/2026");
    expect(maskDateInput("ab25-11")).toBe("25/11");
  });

  it("parses only a complete real calendar day", () => {
    expect(parseDateInput("25/11/2026")).toBe("2026-11-25");
    expect(parseDateInput("29/02/2028")).toBe("2028-02-29");
    expect(parseDateInput("29/02/2027")).toBeNull();
    expect(parseDateInput("31/04/2026")).toBeNull();
    expect(parseDateInput("25/13/2026")).toBeNull();
    expect(parseDateInput("25/11/26")).toBeNull();
    expect(parseDateInput("25/11")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("shows an ISO day as dd/MM/yyyy and nothing for junk", () => {
    expect(isoToDateText("2026-11-05")).toBe("05/11/2026");
    expect(isoToDateText("2026-02-30")).toBe("");
    expect(isoToDateText("")).toBe("");
    expect(isoToDateText(undefined)).toBe("");
  });

  it("adds days across month and year ends", () => {
    expect(addDaysIso("2026-11-25", 7)).toBe("2026-12-02");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("today is a Vietnam calendar day", () => {
    expect(todayIso(new Date("2026-11-25T17:30:00Z"))).toBe("2026-11-26");
    expect(todayAt("08:30", new Date("2026-11-25T17:30:00Z"))).toBe("2026-11-26T08:30");
  });
});

describe("typed date-time input (24h)", () => {
  it("masks dd/MM/yyyy HH:mm while typing", () => {
    expect(maskDateTimeInput("251120260")).toBe("25/11/2026 0");
    expect(maskDateTimeInput("2511202608")).toBe("25/11/2026 08");
    expect(maskDateTimeInput("251120260830")).toBe("25/11/2026 08:30");
    expect(maskDateTimeInput("2511202608301")).toBe("25/11/2026 08:30");
    expect(maskTimeInput("0830")).toBe("08:30");
    expect(maskTimeInput("83")).toBe("83");
  });

  it("parses to the value the BE contract already used (yyyy-MM-ddTHH:mm)", () => {
    expect(parseDateTimeInput("25/11/2026 08:30")).toBe("2026-11-25T08:30");
    expect(parseDateTimeInput("25/11/2026 23:59")).toBe("2026-11-25T23:59");
    expect(parseDateTimeInput("25/11/2026 24:00")).toBeNull();
    expect(parseDateTimeInput("25/11/2026 08:60")).toBeNull();
    expect(parseDateTimeInput("25/11/2026")).toBeNull();
    expect(parseDateTimeInput("31/02/2026 08:30")).toBeNull();
    expect(parseTimeInput("7:30")).toBeNull();
  });

  it("round-trips and splits a local value", () => {
    expect(localToDateTimeText("2026-11-25T08:30")).toBe("25/11/2026 08:30");
    expect(localToDateTimeText("")).toBe("");
    expect(localToDateTimeText("2026-11-25")).toBe("");
    expect(dayOfLocal("2026-11-25T08:30")).toBe("2026-11-25");
    expect(timeOfLocal("2026-11-25T08:30")).toBe("08:30");
    expect(timeOfLocal("")).toBe("");
  });

  it("an instant becomes Vietnam local time", () => {
    expect(toLocalDateTime("2026-11-25T01:30:00Z")).toBe("2026-11-25T08:30");
    expect(toLocalDateTime(new Date("2026-11-25T17:30:00Z"))).toBe("2026-11-26T00:30");
  });
});
