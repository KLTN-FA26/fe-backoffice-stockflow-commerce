"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { REPORTING_URL_KEYS } from "@/constants/reporting";

import { activePreset, presetRange, resolveRange } from "@/lib/date-range";

import type { DateRange } from "@/lib/date-range";

const PARSERS = { from: parseAsString, to: parseAsString };

/**
 * Sales date range in the URL (survives reload / shared links). A missing or invalid range falls
 * back to the default 30 days; the URL is only written when the user picks something.
 */
export function useSalesRange() {
  const [q, setQ] = useQueryStates(PARSERS, { urlKeys: REPORTING_URL_KEYS });
  const range = resolveRange(q.from, q.to);
  return {
    range,
    preset: activePreset(range),
    setRange: (next: DateRange) => void setQ({ from: next.from, to: next.to }),
    setPreset: (days: number) => void setQ(presetRange(days)),
  };
}
