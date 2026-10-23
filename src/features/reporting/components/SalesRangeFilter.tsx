"use client";

import { useState } from "react";

import { REPORTING_LABELS, REPORTING_LIMITS } from "@/constants/reporting";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { validateRange } from "@/lib/date-range";

import type { DateRange } from "@/lib/date-range";

const L = REPORTING_LABELS;

function errorMessage(range: DateRange): string | null {
  const error = validateRange(range);
  if (error === "invalid") return L.rangeInvalid;
  if (error === "reversed") return L.rangeReversed;
  if (error === "tooLong") return L.rangeTooLong(REPORTING_LIMITS.maxRangeDays);
  return null;
}

/** Presets 7 / 30 / 90 days plus a custom from/to, validated against the BE limit before applying. */
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
  const apply = () => {
    if (error === null) onRange(draft);
  };
  return (
    <div role="group" aria-label={L.rangeLabel} className="flex flex-wrap items-end gap-2">
      {REPORTING_LIMITS.rangePresets.map((days) => (
        <Button
          key={days}
          type="button"
          size="sm"
          variant={preset === days ? "default" : "outline"}
          aria-pressed={preset === days}
          onClick={() => onPreset(days)}
        >
          {L.presetDays(days)}
        </Button>
      ))}
      <label className="text-ink-secondary flex flex-col gap-1 text-xs">
        {L.from}
        <Input
          type="date"
          value={draft.from}
          aria-invalid={error !== null}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          className="w-[10.5rem]"
        />
      </label>
      <label className="text-ink-secondary flex flex-col gap-1 text-xs">
        {L.to}
        <Input
          type="date"
          value={draft.to}
          aria-invalid={error !== null}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          className="w-[10.5rem]"
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant={preset === null ? "default" : "outline"}
        disabled={error !== null}
        onClick={apply}
      >
        {L.apply}
      </Button>
      {error && (
        <p role="alert" className="text-danger basis-full text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
