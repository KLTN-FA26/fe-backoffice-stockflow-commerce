"use client";

import { PUT_BACK_LABELS, UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Label } from "@/components/ui/label";

import { WarehouseFilterSelect } from "../WarehouseFilterSelect";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { PutBackListState } from "./usePutBackListState";

const P = PUT_BACK_LABELS;
const F = UI_LABELS.fulfillment.filter;

/**
 * Toolbar hàng đợi trả về kệ (style Vercel, `ListToolbar`): ô tìm (lọc client), hàng facet chọn kho, thanh
 * "Cấu hình" có badge Search chính + Kho xoá riêng được, "Đặt lại" xoá cả hai.
 */
export function PutBackToolbar({ s }: { s: PutBackListState }) {
  const { data: warehouses = [] } = useWarehouseDirectory();
  const warehouseName = warehouses.find((w) => w.warehouseId === s.warehouse)?.name ?? s.warehouse;
  const summaryItems: ListSummaryItem[] = [
    {
      label: P.searchSummary,
      value: s.q ? `“${s.q}”` : P.searchUnused,
      active: s.q !== "",
      onClear: () => s.setQ(""),
    },
    {
      label: F.warehouse,
      value: warehouseName ?? F.allWarehouses,
      active: s.warehouse !== null,
      onClear: () => s.setWarehouse(null),
    },
  ];
  return (
    <ListToolbar
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={P.searchPlaceholder}
      summaryItems={summaryItems}
      onResetAll={s.clearFilters}
      resetDisabled={!s.hasFilters}
      facets={
        <div className="flex items-center gap-2">
          <Label htmlFor="put-back-warehouse" className="text-ink-secondary text-[0.8125rem]">
            {F.warehouse}
          </Label>
          <WarehouseFilterSelect
            id="put-back-warehouse"
            title={F.warehouse}
            value={s.warehouse}
            onChange={s.setWarehouse}
            allLabel={F.allWarehouses}
          />
        </div>
      }
    />
  );
}
