"use client";

import { UI_LABELS } from "@/constants";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { QUEUE_STATUS_VALUES } from "./constants";

import type { CartonCheckQueueState } from "./useCartonCheckQueueState";

const ALL = "__all__";
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[14rem] rounded-[var(--r-sm)] text-[0.8125rem]";
const L = UI_LABELS.cartonCheck;

/** Lọc hàng chờ theo trạng thái (BE `status`); kho là kho của tab theo kho — không có lọc kho. */
export function QueueToolbar({ s }: { s: CartonCheckQueueState }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="queue-status" className="text-ink-secondary text-[0.8125rem]">
          {L.filters.status}
        </Label>
        <Select
          value={s.status ?? ALL}
          onValueChange={(value) => s.setStatus(value === ALL ? "" : value)}
        >
          <SelectTrigger id="queue-status" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={L.filters.status}>
            <SelectItem value={ALL}>{L.filters.allWaiting}</SelectItem>
            {QUEUE_STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {L.statusFilter[value]}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      {s.filtered && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
    </div>
  );
}
