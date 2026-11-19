"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_STATUS_LABELS,
  PRODUCTION_ORDER_STATUSES,
  UI_LABELS,
} from "@/constants";

import { FilterSelect } from "@/components/backoffice/FilterSelect";
import {
  ListToolbar,
  TOOLBAR_ACTION_CLASS,
  TOOLBAR_PRIMARY_CLASS,
} from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import type { ProductionOrderStatus } from "@/constants";
import type { ProductionOrderListState } from "./useProductionOrderListState";

const L = PRODUCTION_LABELS.order;
const STATUS_OPTIONS = PRODUCTION_ORDER_STATUSES.map((value) => ({
  value,
  label: PRODUCTION_ORDER_STATUS_LABELS[value],
}));

interface Option {
  value: string;
  label: string;
}

const labelOf = (options: Option[], value: string | null) =>
  value ? (options.find((o) => o.value === value)?.label ?? value.slice(0, 8)) : L.all;

/**
 * Toolbar danh sách Đơn sản xuất (Mode A): tìm trong trang, lọc trạng thái (BE nhận MỘT trạng thái), facet đơn vị /
 * kho nhận (chỉ hiện khi người dùng đọc được danh mục đó), nút "Lập Đơn sản xuất" khi có quyền CREATE.
 */
export function ProductionOrderToolbar({
  s,
  producerOptions,
  warehouseOptions,
  canCreate,
}: {
  s: ProductionOrderListState;
  producerOptions: Option[];
  warehouseOptions: Option[];
  canCreate: boolean;
}) {
  return (
    <ListToolbar<ProductionOrderStatus, string, string>
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={L.searchPlaceholder}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={s.status ? [s.status] : []}
      // BE nhận MỘT trạng thái → chọn một, bấm lại để bỏ
      onToggleStatus={(value) => s.setStatus(s.status === value ? null : value)}
      onClearStatuses={() => s.setStatus(null)}
      hasStatusFilter={s.status !== null}
      summaryItems={[
        {
          label: L.summarySearch,
          value: s.q || UI_LABELS.common.notEntered,
          active: s.q !== "",
          onClear: () => s.setQ(""),
        },
        {
          label: L.statusFilter,
          value: s.status ? PRODUCTION_ORDER_STATUS_LABELS[s.status] : L.all,
          active: s.status !== null,
          onClear: () => s.setStatus(null),
        },
        {
          label: L.producerFilter,
          value: labelOf(producerOptions, s.producerId),
          active: s.producerId !== null,
          onClear: () => s.setProducerId(null),
        },
        {
          label: L.warehouseFilter,
          value: labelOf(warehouseOptions, s.warehouseId),
          active: s.warehouseId !== null,
          onClear: () => s.setWarehouseId(null),
        },
      ]}
      facets={
        <>
          {producerOptions.length > 0 && (
            <FilterSelect
              id="po-producer"
              label={L.producerFilter}
              allLabel={L.all}
              value={s.producerId}
              options={producerOptions}
              onChange={s.setProducerId}
            />
          )}
          {warehouseOptions.length > 0 && (
            <FilterSelect
              id="po-warehouse"
              label={L.warehouseFilter}
              allLabel={L.all}
              value={s.warehouseId}
              options={warehouseOptions}
              onChange={s.setWarehouseId}
            />
          )}
        </>
      }
      actions={
        canCreate && (
          <Button asChild size="sm" className={`${TOOLBAR_ACTION_CLASS} ${TOOLBAR_PRIMARY_CLASS}`}>
            <Link href={ADMIN_ROUTES.productionOrders.create}>
              <Plus className="size-3.5" /> {L.drawUp}
            </Link>
          </Button>
        )
      }
      onResetAll={s.clearFilters}
      resetDisabled={!s.hasFilters}
    />
  );
}
