"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";

import { statusLabelVi } from "@/lib/status-map";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { useInventoryListFilters } from "../use-list-filters";

export function AdjustmentFilters({
  state,
}: {
  state: ReturnType<typeof useInventoryListFilters>;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void state.setFilters({
          sku: String(form.get("sku") ?? "").trim(),
          location: String(form.get("location") ?? "").trim(),
        });
      }}
      className="border-border-default bg-bg-subtle flex flex-wrap items-end gap-[var(--el-gap)] border p-[var(--card-pad)]"
    >
      <div>
        <Label htmlFor="adjustment-sku-filter">{INVENTORY_LABELS.sku}</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          key={state.filters.sku}
          id="adjustment-sku-filter"
          name="sku"
          defaultValue={state.filters.sku}
        />
      </div>
      <div>
        <Label htmlFor="adjustment-location-filter">{INVENTORY_LABELS.location}</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          key={state.filters.location}
          id="adjustment-location-filter"
          name="location"
          defaultValue={state.filters.location}
        />
      </div>
      <div>
        <Label htmlFor="adjustment-status-filter">{INVENTORY_LABELS.status}</Label>
        <select
          id="adjustment-status-filter"
          value={state.filters.status ?? ""}
          onChange={(event) => {
            void state.setFilters({
              status:
                STOCK_ADJUSTMENT_STATUSES.find((value) => value === event.target.value) ?? null,
            });
          }}
          className="border-border-default bg-bg-surface focus-visible:ring-brand h-9 rounded-[var(--r-sm)] border px-[var(--el-gap)] focus-visible:ring-2"
        >
          <option value="">{INVENTORY_LABELS.all}</option>
          {STOCK_ADJUSTMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabelVi(status, "stock")}
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
    </form>
  );
}
