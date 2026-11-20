"use client";

import { CalendarRange, PackageX } from "lucide-react";

import { PRODUCTION_LABELS, SHORT_BATCH_COLUMNS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import {
  byNeedByDate,
  byWindowStart,
  filterScheduledOrders,
  filterShortBatches,
  sortFlags,
} from "@/features/production-order/schedule-selectors";

import { DelayFlags } from "@/components/backoffice/DelayFlags";
import { Alert } from "@/components/shared/Alert";
import { DetailSection } from "@/components/shared/DetailSection";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { ShortBatchTable } from "../draw-up/ShortBatchTable";
import { ScheduledOrdersTable } from "./ScheduledOrdersTable";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type {
  ProductionSchedule,
  ShortDeliveryBatch,
} from "@/features/production-order/schedule-schemas";
import type { ScheduleFiltersState } from "./useScheduleFilters";

const L = PRODUCTION_LABELS.schedule;
const D = PRODUCTION_LABELS.drawUp;

/** Cột cờ trễ của đợt còn thiếu (PO_NEEDED, DELIVERY_LATE — docs 17 §4.12 bước 48). */
const BATCH_ALERTS: ColumnDef<ShortDeliveryBatch> = {
  key: SHORT_BATCH_COLUMNS.ALERTS,
  header: D.alerts,
  cell: (row) => <DelayFlags flags={sortFlags(row.alerts)} />,
};

type HeaderFilters = Partial<Record<string, ReactNode>>;

/**
 * Hai bảng của lịch (docs 17 §4.12 bước 47): Đơn sản xuất đang mở theo ngày cần hàng, và đợt giao còn thiếu. Lọc
 * BE đã áp khi tải; search chính + search trong cột lọc tiếp trên dòng đã tải. Số trong tiêu đề = số dòng sau lọc.
 */
export function ScheduleSections({
  data,
  filters,
  headerFilters,
  empty,
  onDrawUp,
  isFetching,
  visibleColumns,
}: {
  data: ProductionSchedule;
  filters: ScheduleFiltersState;
  headerFilters: { orders: HeaderFilters; batches: HeaderFilters };
  empty: (title: string, description: string) => ReactNode;
  onDrawUp?: (batch: ShortDeliveryBatch) => void;
  isFetching: boolean;
  visibleColumns: readonly string[];
}) {
  const orders = filterScheduledOrders(byNeedByDate(data.productionOrders), filters.text);
  const batches = filterShortBatches(byWindowStart(data.shortBatches), filters.text);
  return (
    <>
      <RefetchBar active={isFetching} label={L.pageTitle} />
      {data.truncated && <Alert tone="warning">{D.truncated}</Alert>}
      <DetailSection title={`${L.ordersTitle} (${orders.length})`} icon={CalendarRange}>
        <ScheduledOrdersTable
          rows={orders}
          today={todayIso()}
          headerFilters={headerFilters.orders}
          visibleColumns={visibleColumns}
          empty={empty(L.ordersEmptyTitle, L.ordersEmptyDescription)}
        />
      </DetailSection>
      <DetailSection title={`${D.title} (${batches.length})`} icon={PackageX}>
        <ShortBatchTable
          batches={batches}
          onDrawUp={onDrawUp}
          extraColumns={[BATCH_ALERTS]}
          headerFilters={headerFilters.batches}
          empty={empty(L.batchesEmptyTitle, L.batchesEmptyDescription)}
        />
      </DetailSection>
    </>
  );
}
