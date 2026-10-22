"use client";

import { UI_LABELS } from "@/constants";
import { SearchBar } from "@/components/shared/SearchBar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CarrierSelect } from "../CarrierSelect";
import { WarehouseSelect } from "../WarehouseSelect";
import { LOAD_MODE_FILTERS, STATUS_FILTER_OPTIONS } from "./constants";

import type { LoadListState } from "./useLoadListState";

const L = UI_LABELS.shipping;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[12rem] rounded-[var(--r-sm)] text-[0.8125rem]";

/** Lọc chuyến theo mã / biển số, trạng thái, kho, hãng (BE `search`, `status`, `warehouseId`, `carrierId`). */
export function LoadFilters({ s }: { s: LoadListState }) {
  const F = L.shipments;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <SearchBar
        value={s.q}
        onChange={s.setQ}
        placeholder={L.loads.searchPlaceholder}
        aria-label={L.loads.searchPlaceholder}
        className="max-w-xs"
      />
      <div className="flex items-center gap-2">
        <Label htmlFor="load-status" className="text-ink-secondary text-[0.8125rem]">
          {F.statusFilter}
        </Label>
        <Select value={s.status} onValueChange={s.setStatus}>
          <SelectTrigger id="load-status" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={F.statusFilter}>
            <SelectItem value="ALL">{F.all}</SelectItem>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="load-mode" className="text-ink-secondary text-[0.8125rem]">
          {L.ftl.modeFilter}
        </Label>
        <Select value={s.mode} onValueChange={s.setMode}>
          <SelectTrigger id="load-mode" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={L.ftl.modeFilter}>
            <SelectItem value="ALL">{L.ftl.modeAll}</SelectItem>
            {LOAD_MODE_FILTERS.filter((mode) => mode !== "ALL").map((mode) => (
              <SelectItem key={mode} value={mode}>
                {L.load.mode[mode]}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="load-warehouse" className="text-ink-secondary text-[0.8125rem]">
          {F.warehouseFilter}
        </Label>
        <div className="w-[14rem]">
          <WarehouseSelect
            id="load-warehouse"
            value={s.warehouseId}
            onChange={s.setWarehouseId}
            allLabel={F.all}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="load-carrier" className="text-ink-secondary text-[0.8125rem]">
          {F.carrierFilter}
        </Label>
        <div className="w-[14rem]">
          <CarrierSelect
            id="load-carrier"
            value={s.carrierId || null}
            onChange={(carrierId) => s.setCarrierId(carrierId ?? "")}
            allowNone
            noneLabel={F.all}
            placeholder={F.all}
          />
        </div>
      </div>
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {F.clearFilters}
        </Button>
      )}
    </div>
  );
}
