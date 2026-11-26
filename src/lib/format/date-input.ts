/**
 * Typed date / date-time input (WF4 UX R4): text boxes show dd/MM/yyyy and dd/MM/yyyy HH:mm on a 24-hour clock, while
 * forms and URLs keep `yyyy-MM-dd` and `yyyy-MM-ddTHH:mm` (Vietnam time) — the same values the native
 * `<input type="date">` / `datetime-local` held, so nothing sent to the BE changes. Pure helpers: no React, no network.
 */

import { toLocalIsoDate } from "./date";

const TZ = "Asia/Ho_Chi_Minh";
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
/** A typed date is accepted from this year (a 2-digit year typo like "26" must not become year 0026). */
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

function isRealDay(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Digits only, grouped as dd/MM/yyyy[ HH:mm] — what a person typing "251120260830" should see while typing. */
function mask(raw: string, withTime: boolean): string {
  const digits = raw.replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  const groups = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  let out = groups.filter(Boolean).join("/");
  if (withTime && digits.length > 8) {
    const time = [digits.slice(8, 10), digits.slice(10, 12)].filter(Boolean).join(":");
    out += ` ${time}`;
  }
  return out;
}

/** Typed text → "25/11/2026" shape, slashes added as digits arrive. */
export function maskDateInput(raw: string): string {
  return mask(raw, false);
}

/** Typed text → "25/11/2026 08:30" shape, slash / colon added as digits arrive. */
export function maskDateTimeInput(raw: string): string {
  return mask(raw, true);
}

/** Typed time → "08:30" shape. */
export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(":");
}

/** "25/11/2026" → `2026-11-25`; incomplete or not a real calendar day → null. */
export function parseDateInput(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  if (!isRealDay(Number(y), Number(m), Number(d))) return null;
  return `${y}-${m}-${d}`;
}

/** "08:30" → "08:30"; 24-hour clock, incomplete or out of range → null. */
export function parseTimeInput(text: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, h, m] = match;
  if (Number(h) > 23 || Number(m) > 59) return null;
  return `${h}:${m}`;
}

/** "25/11/2026 08:30" → `2026-11-25T08:30`; incomplete or invalid → null. */
export function parseDateTimeInput(text: string): string | null {
  const match = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, date, time] = match;
  const day = parseDateInput(date ?? "");
  const clock = parseTimeInput(time ?? "");
  return day && clock ? `${day}T${clock}` : null;
}

/** `2026-11-25` → "25/11/2026"; empty / invalid → "". */
export function isoToDateText(iso: string | undefined): string {
  const match = iso ? ISO_DAY.exec(iso) : null;
  if (!match) return "";
  const [, y, m, d] = match;
  return isRealDay(Number(y), Number(m), Number(d)) ? `${d}/${m}/${y}` : "";
}

/** `2026-11-25T08:30` → "25/11/2026 08:30"; empty / invalid → "". */
export function localToDateTimeText(local: string | undefined): string {
  const match = local ? ISO_LOCAL.exec(local) : null;
  if (!match) return "";
  const [, day, h, m] = match;
  const date = isoToDateText(day);
  return date && parseTimeInput(`${h}:${m}`) ? `${date} ${h}:${m}` : "";
}

/** Day part of `yyyy-MM-ddTHH:mm` (or "" when not that shape). */
export function dayOfLocal(local: string | undefined): string {
  return (local && ISO_LOCAL.exec(local)?.[1]) || "";
}

/** Time part ("HH:mm") of `yyyy-MM-ddTHH:mm` (or "" when not that shape). */
export function timeOfLocal(local: string | undefined): string {
  const match = local ? ISO_LOCAL.exec(local) : null;
  return match ? `${match[2]}:${match[3]}` : "";
}

/** Today's calendar day in Vietnam, `yyyy-MM-dd`. */
export function todayIso(now: Date = new Date()): string {
  return toLocalIsoDate(now.toISOString());
}

/** `yyyy-MM-dd` plus a whole number of days (negative = earlier). */
export function addDaysIso(iso: string, days: number): string {
  const match = ISO_DAY.exec(iso);
  if (!match) return iso;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return at.toISOString().slice(0, 10);
}

/** An instant as `yyyy-MM-ddTHH:mm` in Vietnam time (the value a date-time field holds). */
export function toLocalDateTime(at: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Today in Vietnam at a fixed clock time, e.g. `todayAt("08:30")` → `2026-11-26T08:30`. */
export function todayAt(time: string, now: Date = new Date()): string {
  return `${todayIso(now)}T${time}`;
}
