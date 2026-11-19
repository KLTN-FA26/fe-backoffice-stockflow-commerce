"use client";

import { RotateCcw } from "lucide-react";

import { PRODUCTION_LABELS } from "@/constants";

import { FilterSelect } from "@/components/backoffice/FilterSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { ScheduleFiltersState } from "./useScheduleFilters";

const L = PRODUCTION_LABELS.schedule;

interface Option {
  value: string;
  label: string;
}

/**
 * Hàng lọc của lịch sản xuất (Mode A, không khung bao): đơn vị sản xuất, kho (chỉ khi đọc được danh mục kho), khoảng
 * ngày (ngày cần hàng / ngày bắt đầu cửa sổ giao), chỉ dòng có cảnh báo, đặt lại.
 */
export function ScheduleFilters({
  state,
  producerOptions,
  warehouseOptions,
}: {
  state: ScheduleFiltersState;
  producerOptions: Option[];
  warehouseOptions: Option[];
}) {
  const { filters, set } = state;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {producerOptions.length > 0 && (
        <FilterSelect
          id="schedule-producer"
          label={L.producerFilter}
          allLabel={L.all}
          value={filters.producerId}
          options={producerOptions}
          onChange={(producerId) => set({ producerId })}
        />
      )}
      {warehouseOptions.length > 0 && (
        <FilterSelect
          id="schedule-warehouse"
          label={L.warehouseFilter}
          allLabel={L.all}
          value={filters.warehouseId}
          options={warehouseOptions}
          onChange={(warehouseId) => set({ warehouseId })}
        />
      )}
      <div className="flex items-center gap-2">
        <Label htmlFor="schedule-from" className="text-ink-secondary text-[0.8125rem]">
          {L.from}
        </Label>
        <DatePicker
          id="schedule-from"
          className="w-[10rem]"
          value={filters.from ?? ""}
          onChange={(from) => set({ from: from || null })}
          clearable
          aria-invalid={state.rangeInvalid || undefined}
        />
        <Label htmlFor="schedule-to" className="text-ink-secondary text-[0.8125rem]">
          {L.to}
        </Label>
        <DatePicker
          id="schedule-to"
          className="w-[10rem]"
          value={filters.to ?? ""}
          onChange={(to) => set({ to: to || null })}
          clearable
          aria-invalid={state.rangeInvalid || undefined}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="schedule-alerts-only"
          checked={filters.alertsOnly}
          onCheckedChange={(checked) => set({ alertsOnly: checked === true })}
        />
        <Label htmlFor="schedule-alerts-only" className="text-ink-secondary text-[0.8125rem]">
          {L.alertsOnly}
        </Label>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={state.reset}
        disabled={!state.hasFilters}
      >
        <RotateCcw className="size-3.5" /> {L.reset}
      </Button>
      {state.rangeInvalid && (
        <p role="alert" className="text-danger w-full text-xs">
          {L.rangeInvalid}
        </p>
      )}
    </div>
  );
}
