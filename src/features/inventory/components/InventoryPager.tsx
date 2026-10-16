"use client";

import { INVENTORY_LABELS, INVENTORY_PAGE_SIZES } from "@/constants/inventory";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { inventoryPageRange } from "../selectors";

import type { AdjustmentPage, MovementPage } from "../types";

interface InventoryPagerProps {
  data: MovementPage | AdjustmentPage;
  pending: boolean;
  size: number;
  setSize: (size: number) => void;
  setPage: (page: number) => void;
}

export function InventoryPager({ data, pending, size, setSize, setPage }: InventoryPagerProps) {
  const range = inventoryPageRange(data);
  return (
    <footer className="border-border-default bg-bg-subtle flex items-center justify-between gap-[var(--el-gap)] border-t p-[var(--card-pad)]">
      <div className="flex items-center gap-[var(--el-gap)]">
        <Label htmlFor="inventory-page-size">{INVENTORY_LABELS.perPage}</Label>
        <select
          id="inventory-page-size"
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
          disabled={pending}
          className="border-border-default bg-bg-surface focus-visible:ring-brand rounded-[var(--r-sm)] border p-[calc(var(--el-gap)/2)] focus-visible:ring-2"
        >
          {INVENTORY_PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className="text-ink-secondary tabular-nums">
          {INVENTORY_LABELS.showing} {range.first}–{range.last} / {range.total}
        </span>
      </div>
      <nav aria-label={INVENTORY_LABELS.page} className="flex items-center gap-[var(--el-gap)]">
        <Button
          className="rounded-[var(--r-sm)]"
          type="button"
          variant="outline"
          size="sm"
          disabled={!data.hasPrevious || pending}
          onClick={() => setPage(data.page)}
        >
          {INVENTORY_LABELS.previous}
        </Button>
        <span className="tabular-nums">
          {data.page + 1} / {Math.max(1, data.totalPages)}
        </span>
        <Button
          className="rounded-[var(--r-sm)]"
          type="button"
          variant="outline"
          size="sm"
          disabled={!data.hasNext || pending}
          onClick={() => setPage(data.page + 2)}
        >
          {INVENTORY_LABELS.next}
        </Button>
      </nav>
    </footer>
  );
}
