"use client";

import { UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { QUEUE_STATUS_VALUES } from "./constants";

import type { PackingQueueState } from "./usePackingQueueState";

const ALL = "__all__";
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[14rem] rounded-[var(--r-sm)] text-[0.8125rem]";
const L = UI_LABELS.packing;

/** Lọc hàng chờ theo kho và trạng thái (BE `warehouseId`, `status`). */
export function QueueToolbar({ s }: { s: PackingQueueState }) {
  const { data: warehouses = [], isError, refetch } = useWarehouseDirectory();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="queue-warehouse" className="text-ink-secondary text-[0.8125rem]">
          {L.filters.warehouse}
        </Label>
        <Select
          value={s.warehouseId || ALL}
          onValueChange={(value) => s.setWarehouseId(value === ALL ? "" : value)}
        >
          <SelectTrigger id="queue-warehouse" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>{L.filters.all}</SelectItem>
              {s.warehouseId && !warehouses.some((w) => w.warehouseId === s.warehouseId) && (
                <SelectItem value={s.warehouseId}>{s.warehouseId}</SelectItem>
              )}
              {warehouses.map((w) => (
                <SelectItem key={w.warehouseId} value={w.warehouseId}>
                  {w.code ? `${w.code} · ${w.name}` : w.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
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
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>{L.filters.allWaiting}</SelectItem>
              {QUEUE_STATUS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {L.statusFilter[value]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {isError && (
        <span className="text-danger text-xs">
          {L.filters.warehouseLoadFailed}{" "}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void refetch()}>
            {UI_LABELS.common.retry}
          </Button>
        </span>
      )}
      {s.filtered && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
    </div>
  );
}
