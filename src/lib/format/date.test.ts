import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./date";

describe("formatDate / formatDateTime (house format dd/MM/yyyy, 24h)", () => {
  it("date is dd/MM/yyyy, not the locale's '25 thg 11, 2026'", () => {
    expect(formatDate("2026-11-25T08:15:00+07:00")).toBe("25/11/2026");
    expect(formatDate("2026-03-05T10:00:00+07:00")).toBe("05/03/2026");
  });

  it("a plain YYYY-MM-DD is that calendar day", () => {
    expect(formatDate("2026-12-01")).toBe("01/12/2026");
  });

  it("an instant is shown as its day in Vietnam time (23:58 UTC+7 stays that day)", () => {
    expect(formatDate("2026-11-25T16:58:00Z")).toBe("25/11/2026");
    expect(formatDate("2026-11-25T17:30:00Z")).toBe("26/11/2026");
  });

  it("date-time is dd/MM/yyyy HH:mm on a 24-hour clock, date first", () => {
    expect(formatDateTime("2026-11-25T23:58:00+07:00")).toBe("25/11/2026 23:58");
    expect(formatDateTime("2026-11-25T00:05:00+07:00")).toBe("25/11/2026 00:05");
    expect(formatDateTime("2026-11-25T13:30:00+07:00")).toBe("25/11/2026 13:30");
  });

  it("an invalid date throws (callers show the raw text instead)", () => {
    expect(() => formatDate("không-phải-ngày")).toThrow(RangeError);
  });
});
