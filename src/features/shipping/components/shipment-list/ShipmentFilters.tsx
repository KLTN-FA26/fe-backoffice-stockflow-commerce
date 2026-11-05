"use client";

import { UI_LABELS } from "@/constants";
import { SearchBar } from "@/components/shared/SearchBar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CarrierSelect } from "../CarrierSelect";
import { WarehouseSelect } from "../WarehouseSelect";
import { STATUS_FILTER_OPTIONS } from "./constants";

import type { ShipmentListState } from "./useShipmentListState";

const L = UI_LABELS.shipping.shipments;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[12rem] rounded-[var(--r-sm)] text-[0.8125rem]";

/** Lọc lô giao theo mã, trạng thái, kho, hãng (BE `search`, `status`, `warehouseId`, `carrierId`). */
export function ShipmentFilters({ s }: { s: ShipmentListState }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <SearchBar
        value={s.q}
        onChange={s.setQ}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchPlaceholder}
        className="max-w-xs"
      />
      <div className="flex items-center gap-2">
        <Label htmlFor="shipment-status" className="text-ink-secondary text-[0.8125rem]">
          {L.statusFilter}
        </Label>
        <Select value={s.status} onValueChange={s.setStatus}>
          <SelectTrigger id="shipment-status" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={L.statusFilter}>
            <SelectItem value="ALL">{L.all}</SelectItem>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="shipment-warehouse" className="text-ink-secondary text-[0.8125rem]">
          {L.warehouseFilter}
        </Label>
        <div className="w-[14rem]">
          <WarehouseSelect
            id="shipment-warehouse"
            value={s.warehouseId}
            onChange={s.setWarehouseId}
            allLabel={L.all}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="shipment-carrier" className="text-ink-secondary text-[0.8125rem]">
          {L.carrierFilter}
        </Label>
        <div className="w-[14rem]">
          <CarrierSelect
            id="shipment-carrier"
            value={s.carrierId || null}
            onChange={(carrierId) => s.setCarrierId(carrierId ?? "")}
            allowNone
            noneLabel={L.all}
            placeholder={L.all}
          />
        </div>
      </div>
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
    </div>
  );
}
