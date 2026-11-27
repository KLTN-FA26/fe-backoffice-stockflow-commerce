/**
 * Date formatting — Asia/Ho_Chi_Minh, vi-VN.
 *
 * Always explicit timezone to prevent date drift.
 */

const TZ = "Asia/Ho_Chi_Minh";

type Part = "day" | "month" | "year" | "hour" | "minute";

/**
 * Date parts in Vietnam time. `Intl` throws a RangeError for an invalid date — callers rely on that
 * (a hand-edited URL date is shown as raw text instead).
 */
function partsOf(date: Date, withTime: boolean): Record<Part, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
    timeZone: TZ,
  }).formatToParts(date);
  const value = (type: Part) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: value("day"),
    month: value("month"),
    year: value("year"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

/**
 * House format (WF4 UX R4): dates are dd/MM/yyyy and date-times dd/MM/yyyy HH:mm on a 24-hour clock, in
 * Vietnam time. ICU's vi-VN `dateStyle` gives "15 thg 3, 2026" (and puts the time first), so the parts are
 * assembled here instead of trusting a locale style. Same output as the storefront's `formatDate`.
 */
/** e.g. "15/03/2026". A plain `YYYY-MM-DD` is that calendar day; an instant is its day in Vietnam. */
export function formatDate(iso: string): string {
  const { day, month, year } = partsOf(new Date(iso), false);
  return `${day}/${month}/${year}`;
}

/** e.g. "15/03/2026 14:30" (24-hour clock). */
export function formatDateTime(iso: string): string {
  const { day, month, year, hour, minute } = partsOf(new Date(iso), true);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/** e.g. "14:30:05" */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeStyle: "medium",
    timeZone: TZ,
  }).format(new Date(iso));
}

/**
 * Calendar date (YYYY-MM-DD) of an instant as seen in Asia/Ho_Chi_Minh.
 * `iso.slice(0, 10)` would take the UTC date — off by one day before 07:00 VN time.
 */
export function toLocalIsoDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** True if the date is in the past (for overdue warnings — BR-06 module 02). */
export function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date();
}

/** True if the date is today. */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Relative time: "2 ngày trước", "trong 3 giờ". */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

  const absDiff = Math.abs(diff);
  const sign = diff > 0 ? -1 : 1; // past = negative in RTF

  if (absDiff < 60_000) return rtf.format(sign * Math.round(absDiff / 1000), "second");
  if (absDiff < 3_600_000) return rtf.format(sign * Math.round(absDiff / 60_000), "minute");
  if (absDiff < 86_400_000) return rtf.format(sign * Math.round(absDiff / 3_600_000), "hour");
  if (absDiff < 30 * 86_400_000) return rtf.format(sign * Math.round(absDiff / 86_400_000), "day");
  return formatDate(iso);
}
