"use client";

import { PRODUCTION_LABELS, SHORT_BATCH_COLUMNS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import { sortFlags } from "@/features/production-order/schedule-selectors";

import { DelayFlags } from "@/components/backoffice/DelayFlags";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import { Skeleton } from "@/components/shared/Skeleton";

import { ShortBatchTable } from "../draw-up/ShortBatchTable";
import { ScheduledOrdersTable } from "./ScheduledOrdersTable";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type {
  ScheduledProductionOrder,
  ShortDeliveryBatch,
} from "@/features/production-order/schedule-schemas";
import type { ScheduleTab } from "./useScheduleTab";

const L = PRODUCTION_LABELS.schedule;
const D = PRODUCTION_LABELS.drawUp;
const ID_PREFIX = "production-schedule";

/** Cột cờ trễ của đợt còn thiếu (PO_NEEDED, DELIVERY_LATE — docs 17 §4.12 bước 48). */
const BATCH_ALERTS: ColumnDef<ShortDeliveryBatch> = {
  key: SHORT_BATCH_COLUMNS.ALERTS,
  header: D.alerts,
  cell: (row) => <DelayFlags flags={sortFlags(row.alerts)} />,
};

type HeaderFilters = Partial<Record<string, ReactNode>>;

/**
 * Thanh tab theo việc của lịch (docs 17 §4.12 bước 47), đặt đầu trang vì nó quyết định nội dung toolbar và bảng bên
 * dưới: "Cần lập Đơn sản xuất" (đợt giao còn thiếu — việc phải làm) và "Đơn sản xuất đang mở" (theo dõi tiến độ, cờ
 * trễ). Số trên tab = số dòng sau lọc; vắng khi đang tải. `tab` null (đang tải, URL chưa chọn) → giữ chỗ, không nhảy.
 */
export function ScheduleTabBar({
  tab,
  onTabChange,
  counts,
}: {
  tab: ScheduleTab | null;
  onTabChange: (tab: ScheduleTab) => void;
  counts?: { batches: number; orders: number };
}) {
  if (tab === null) return <Skeleton className="mb-3 h-9 w-[22rem] rounded-lg" />;
  return (
    <PageTabs<ScheduleTab>
      // Nhịp 12px đều giữa tab / toolbar / Cấu hình / bảng
      className="mb-3"
      idPrefix={ID_PREFIX}
      ariaLabel={L.pageTitle}
      value={tab}
      onChange={onTabChange}
      tabs={[
        { value: "batches", label: L.tabs.batches, count: counts?.batches },
        { value: "orders", label: L.tabs.orders, count: counts?.orders },
      ]}
    />
  );
}

/** Bảng của tab đang mở — mỗi lần một bảng full trang. */
export function ScheduleSections({
  tab,
  orders,
  batches,
  headerFilters,
  empty,
  onDrawUp,
  visibleColumns,
}: {
  tab: ScheduleTab;
  /** Đã xếp + lọc. */
  orders: ScheduledProductionOrder[];
  batches: ShortDeliveryBatch[];
  headerFilters: { orders: HeaderFilters; batches: HeaderFilters };
  empty: (title: string, description: string) => ReactNode;
  onDrawUp?: (batch: ShortDeliveryBatch) => void;
  visibleColumns: readonly string[];
}) {
  return (
    <PageTabPanel idPrefix={ID_PREFIX} value={tab}>
      {tab === "orders" ? (
        <ScheduledOrdersTable
          rows={orders}
          today={todayIso()}
          headerFilters={headerFilters.orders}
          visibleColumns={visibleColumns}
          empty={empty(L.ordersEmptyTitle, L.ordersEmptyDescription)}
        />
      ) : (
        <ShortBatchTable
          batches={batches}
          onDrawUp={onDrawUp}
          extraColumns={[BATCH_ALERTS]}
          headerFilters={headerFilters.batches}
          empty={empty(L.batchesEmptyTitle, L.batchesEmptyDescription)}
          stickyHeader
        />
      )}
    </PageTabPanel>
  );
}
