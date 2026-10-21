"use client";

import {
  INVENTORY_LABELS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";
import { statusLabelVi } from "@/lib/status-map";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import type { useInventoryListFilters } from "../use-list-filters";

type ListState = ReturnType<typeof useInventoryListFilters>;
type AdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];
type MovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

const L = INVENTORY_LABELS;
const ALL = "all";
const STATUS_OPTIONS = STOCK_ADJUSTMENT_STATUSES.map((value) => ({
  value,
  label: statusLabelVi(value, "stock") ?? value,
}));

/**
 * Toolbar chuẩn Mode A cho hai trang kho: search chính = SKU, trạng thái qua nút Filter (phiếu
 * điều chỉnh), hàng facet nghiệp vụ dưới toolbar (vị trí, loại biến động). Bộ lọc vẫn trên URL.
 */
export function InventoryToolbar({
  state,
  mode,
}: {
  state: ListState;
  mode: "adjustment" | "movement";
}) {
  const { filters } = state;
  const status = filters.status;
  const summary = [
    {
      label: L.sku,
      value: filters.sku || "Chưa nhập",
      active: Boolean(filters.sku),
      onClear: () => void state.setFilters({ sku: "" }),
    },
    {
      label: L.location,
      value: filters.location || L.all,
      active: Boolean(filters.location),
      onClear: () => void state.setFilters({ location: "" }),
    },
    mode === "adjustment"
      ? {
          label: L.status,
          value: status ? (statusLabelVi(status, "stock") ?? status) : L.all,
          active: Boolean(status),
          onClear: () => void state.setFilters({ status: null }),
        }
      : {
          label: L.movementType,
          value: filters.type ? STOCK_MOVEMENT_LABELS[filters.type] : L.all,
          active: Boolean(filters.type),
          onClear: () => void state.setFilters({ type: null }),
        },
  ];

  return (
    <div>
      <ListToolbar<AdjustmentStatus, string, string>
        search={filters.sku}
        onSearchChange={(sku) => void state.setFilters({ sku })}
        searchPlaceholder={`${L.sku}…`}
        {...(mode === "adjustment" && {
          statusOptions: STATUS_OPTIONS,
          selectedStatuses: status ? [status] : [],
          // BE nhận MỘT trạng thái → chọn một, bấm lại để bỏ
          onToggleStatus: (value: AdjustmentStatus) =>
            void state.setFilters({ status: status === value ? null : value }),
          onClearStatuses: () => void state.setFilters({ status: null }),
          hasStatusFilter: Boolean(status),
        })}
        summaryItems={summary}
        onResetAll={() => void state.reset()}
        resetDisabled={!state.hasFilters}
        facets={
          <>
            <FacetField id={`${mode}-location`} label={L.location}>
              <Input
                id={`${mode}-location`}
                value={filters.location}
                onChange={(event) => void state.setFilters({ location: event.target.value })}
                className={`${FORM_INPUT_CLASS} w-[13rem]`}
              />
            </FacetField>
            {mode === "movement" && (
              <FacetField id="movement-type" label={L.movementType}>
                <Select
                  value={filters.type ?? ALL}
                  onValueChange={(value) =>
                    void state.setFilters({
                      type: value === ALL ? null : (value as MovementType),
                    })
                  }
                >
                  <SelectTrigger id="movement-type" className={`${FORM_SELECT_CLASS} w-[13rem]`}>
                    <SelectValue />
                  </SelectTrigger>
                  <TitledSelectContent title={L.movementType}>
                    <SelectItem value={ALL}>{L.all}</SelectItem>
                    {STOCK_MOVEMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {STOCK_MOVEMENT_LABELS[type]}
                      </SelectItem>
                    ))}
                  </TitledSelectContent>
                </Select>
              </FacetField>
            )}
          </>
        }
      />
    </div>
  );
}

function FacetField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-ink-secondary text-[0.8125rem]">
        {label}
      </Label>
      {children}
    </div>
  );
}
