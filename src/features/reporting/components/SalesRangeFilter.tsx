"use client";

import { useState } from "react";
import { cn } from "cn";

import { REPORTING_LABELS, REPORTING_LIMITS } from "@/constants/reporting";

import { validateRange } from "@/lib/date-range";

import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import type { DateRange } from "@/lib/date-range";

const L = REPORTING_LABELS;
const DATE_CLASS = "h-8 w-[9.5rem]";

function errorMessage(range: DateRange): string | null {
  const error = validateRange(range);
  if (error === "invalid") return L.rangeInvalid;
  if (error === "reversed") return L.rangeReversed;
  if (error === "tooLong") return L.rangeTooLong(REPORTING_LIMITS.maxRangeDays);
  return null;
}

/**
 * Presets 7 / 30 / 90 days (segmented, kiểu Tabs của shadcn) plus a custom from/to, validated
 * against the BE limit before applying. Một hàng cao 32px — nhãn ngày chỉ cho screen reader.
 */
export function SalesRangeFilter({
  range,
  preset,
  onPreset,
  onRange,
}: {
  range: DateRange;
  preset: number | null;
  onPreset: (days: number) => void;
  onRange: (range: DateRange) => void;
}) {
  // Draft of the custom inputs; seeded from the applied range, re-seeded when it changes.
  const [draft, setDraft] = useState<DateRange>(range);
  const [seed, setSeed] = useState(range);
  if (seed.from !== range.from || seed.to !== range.to) {
    setSeed(range);
    setDraft(range);
  }
  const error = errorMessage(draft);
  const unchanged = draft.from === range.from && draft.to === range.to;
  const apply = () => {
    if (error === null) onRange(draft);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label={L.rangeLabel} className="flex flex-wrap items-center gap-2">
        <div className="bg-bg-muted inline-flex h-8 items-center gap-0.5 rounded-[var(--r-md)] p-0.5">
          {REPORTING_LIMITS.rangePresets.map((days) => (
            <Button
              key={days}
              type="button"
              variant="ghost"
              aria-pressed={preset === days}
              onClick={() => onPreset(days)}
              className={cn(
                "text-ink-secondary hover:text-ink-primary h-7 rounded-[var(--r-sm)] px-2.5 text-[0.8125rem] font-medium hover:bg-transparent",
                preset === days && "bg-bg-surface text-ink-primary shadow-[var(--sh-sm)]",
              )}
            >
              {L.presetDays(days)}
            </Button>
          ))}
        </div>
        <Label htmlFor="sales-range-from" className="sr-only">
          {L.from}
        </Label>
        <DatePicker
          id="sales-range-from"
          value={draft.from}
          aria-invalid={error !== null}
          onChange={(from) => setDraft({ ...draft, from })}
          className={DATE_CLASS}
        />
        <span className="text-ink-tertiary text-xs" aria-hidden>
          –
        </span>
        <Label htmlFor="sales-range-to" className="sr-only">
          {L.to}
        </Label>
        <DatePicker
          id="sales-range-to"
          value={draft.to}
          aria-invalid={error !== null}
          onChange={(to) => setDraft({ ...draft, to })}
          className={DATE_CLASS}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={error !== null || unchanged}
          onClick={apply}
          className="h-8"
        >
          {L.apply}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
