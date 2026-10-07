/**
 * Date formatting — Asia/Ho_Chi_Minh, vi-VN.
 *
 * Always explicit timezone to prevent date drift.
 */

const TZ = "Asia/Ho_Chi_Minh";

/** e.g. "15 thg 3, 2026" */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: TZ,
  }).format(new Date(iso));
}

/** e.g. "15 thg 3, 2026 14:30" */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
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
