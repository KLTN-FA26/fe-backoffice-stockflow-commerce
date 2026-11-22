"use client";

import { useId } from "react";

import { PRODUCTION_LABELS } from "@/constants";

import { HeaderFilterPopover } from "@/components/shared/ColumnHeaderFilter";
import { DatePicker } from "@/components/shared/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { ScheduleFiltersState } from "./useScheduleFilters";

const L = PRODUCTION_LABELS.schedule;
const LABEL_CLASS = "text-ink-secondary text-[0.8125rem]";

/** Khoảng ngày (BE `from`/`to`): ngày cần hàng của Đơn sản xuất, ngày bắt đầu cửa sổ của đợt giao. */
export function DateRangeFilter({ state, label }: { state: ScheduleFiltersState; label: string }) {
  const id = useId();
  const { filters, set } = state;
  const invalid = state.rangeInvalid || undefined;
  return (
    <HeaderFilterPopover
      label={label}
      active={filters.from !== null || filters.to !== null}
      onClear={() => set({ from: null, to: null })}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-from`} className={LABEL_CLASS}>
          {L.from}
        </Label>
        <DatePicker
          id={`${id}-from`}
          value={filters.from ?? ""}
          onChange={(from) => set({ from: from || null })}
          clearable
          aria-invalid={invalid}
        />
        <Label htmlFor={`${id}-to`} className={`${LABEL_CLASS} mt-1`}>
          {L.to}
        </Label>
        <DatePicker
          id={`${id}-to`}
          value={filters.to ?? ""}
          onChange={(to) => set({ to: to || null })}
          clearable
          aria-invalid={invalid}
        />
        {state.rangeInvalid && <p className="text-danger text-xs">{L.rangeInvalid}</p>}
      </div>
    </HeaderFilterPopover>
  );
}

export function AlertsFilter({ state, label }: { state: ScheduleFiltersState; label: string }) {
  const id = useId();
  const { filters, set } = state;
  return (
    <HeaderFilterPopover label={label} active={filters.alertsOnly}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={filters.alertsOnly}
          onCheckedChange={(checked) => set({ alertsOnly: checked === true })}
        />
        <Label htmlFor={id} className={LABEL_CLASS}>
          {L.alertsOnly}
        </Label>
      </div>
    </HeaderFilterPopover>
  );
}
