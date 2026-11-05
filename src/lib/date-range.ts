/** Inclusive yyyy-MM-dd date ranges in the BE reporting zone (Asia/Ho_Chi_Minh), validated against the BE limit. */
import { REPORTING_LIMITS } from "@/constants/reporting";

import { toLocalIsoDate } from "@/lib/format/date";

/** Inclusive ISO dates (yyyy-MM-dd), Asia/Ho_Chi_Minh. */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** A real calendar date in yyyy-MM-dd (rejects 2026-02-31). */
export function isValidIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const ms = toUtcMs(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(value);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive number of days: 2026-10-01..2026-10-01 is 1. */
export function inclusiveDays(range: DateRange): number {
  return Math.round((toUtcMs(range.to) - toUtcMs(range.from)) / DAY_MS) + 1;
}

/** Today in Asia/Ho_Chi_Minh (the BE's reporting zone), not the browser's. */
export function todayIso(now: Date = new Date()): string {
  return toLocalIsoDate(now.toISOString());
}

/** Last `days` days ending today, inclusive. */
export function presetRange(days: number, today: string = todayIso()): DateRange {
  return { from: addDays(today, -(days - 1)), to: today };
}

export type RangeError = "invalid" | "reversed" | "tooLong";

/** BE: from > to or a range over 366 days is 400 VALIDATION_FAILED — refuse before sending. */
export function validateRange(range: DateRange): RangeError | null {
  if (!isValidIsoDay(range.from) || !isValidIsoDay(range.to)) return "invalid";
  if (range.from > range.to) return "reversed";
  if (inclusiveDays(range) > REPORTING_LIMITS.maxRangeDays) return "tooLong";
  return null;
}

/** URL values -> the range the widgets use; anything missing or invalid falls back to the default. */
export function resolveRange(
  from: string | null,
  to: string | null,
  today: string = todayIso(),
): DateRange {
  const candidate = { from: from ?? "", to: to ?? "" };
  return validateRange(candidate) === null
    ? candidate
    : presetRange(REPORTING_LIMITS.defaultRangeDays, today);
}

/** The preset (in days) a range equals, or null for a custom range. */
export function activePreset(range: DateRange, today: string = todayIso()): number | null {
  return (
    REPORTING_LIMITS.rangePresets.find((days) => {
      const preset = presetRange(days, today);
      return preset.from === range.from && preset.to === range.to;
    }) ?? null
  );
}
