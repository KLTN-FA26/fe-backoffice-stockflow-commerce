"use client";

import {
  INVENTORY_LABELS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { useInventoryListFilters } from "../use-list-filters";

export function MovementFilters({ state }: { state: ReturnType<typeof useInventoryListFilters> }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        state.setFilters({
          sku: String(form.get("sku") ?? "").trim(),
          location: String(form.get("location") ?? "").trim(),
        });
      }}
      className="border-border-default bg-bg-subtle flex flex-wrap items-end gap-[var(--el-gap)] border p-[var(--card-pad)]"
    >
      <div>
        <Label htmlFor="movement-sku">{INVENTORY_LABELS.sku}</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          key={state.filters.sku}
          id="movement-sku"
          name="sku"
          defaultValue={state.filters.sku}
        />
      </div>
      <div>
        <Label htmlFor="movement-location">{INVENTORY_LABELS.location}</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          key={state.filters.location}
          id="movement-location"
          name="location"
          defaultValue={state.filters.location}
        />
      </div>
      <div>
        <Label htmlFor="movement-type">{INVENTORY_LABELS.movementType}</Label>
        <select
          id="movement-type"
          value={state.filters.type ?? ""}
          onChange={(event) => {
            const type = STOCK_MOVEMENT_TYPES.find((value) => value === event.target.value) ?? null;
            void state.setFilters({ type });
          }}
          className="border-border-default bg-bg-surface focus-visible:ring-brand h-9 rounded-[var(--r-sm)] border px-[var(--el-gap)] focus-visible:ring-2"
        >
          <option value="">{INVENTORY_LABELS.all}</option>
          {STOCK_MOVEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {STOCK_MOVEMENT_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <Button className="rounded-[var(--r-sm)]" type="submit" size="sm">
        {INVENTORY_LABELS.apply}
      </Button>
      <Button
        className="rounded-[var(--r-sm)]"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void state.reset()}
      >
        {INVENTORY_LABELS.reset}
      </Button>
      {state.hasFilters && (
        <span className="text-ink-secondary text-xs">{INVENTORY_LABELS.filtered}</span>
      )}
    </form>
  );
}
