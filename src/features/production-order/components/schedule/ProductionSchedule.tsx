"use client";

import {
  PRODUCER_PERMISSIONS,
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_SCHEDULE_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useProducerDirectory } from "@/lib/references/producer-options";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { useProductionSchedule } from "@/features/production-order/queries";
import {
  byNeedByDate,
  byWindowStart,
  filterScheduledOrders,
  filterShortBatches,
} from "@/features/production-order/schedule-selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { DrawUpDialog } from "../draw-up/DrawUpDialog";
import { ScheduleEmpty } from "./ScheduleEmpty";
import { scheduleHeaderFilters, withCurrent } from "./ScheduleHeaderFilters";
import { ScheduleSections, ScheduleTabBar } from "./ScheduleSections";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { useDrawUpLink } from "./useDrawUpLink";
import { useScheduleColumns } from "./useScheduleColumns";
import { useScheduleFilters } from "./useScheduleFilters";
import { useScheduleTab } from "./useScheduleTab";

const L = PRODUCTION_LABELS.schedule;

function ScheduleContent() {
  const can = usePermissionChecker();
  const canRead = can(PRODUCTION_SCHEDULE_PERMISSIONS.read);
  const filters = useScheduleFilters();
  const columns = useScheduleColumns();
  const schedule = useProductionSchedule(filters.params, canRead);
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read));
  const warehouses = useWarehouseDirectory(can(WAREHOUSE_PERMISSIONS.read));
  const canDrawUp = can(PRODUCTION_ORDER_PERMISSIONS.create);

  const data = schedule.data;
  const orders = data
    ? filterScheduledOrders(byNeedByDate(data.productionOrders), filters.text)
    : [];
  const batches = data ? filterShortBatches(byWindowStart(data.shortBatches), filters.text) : [];
  const drawUp = useDrawUpLink(data?.shortBatches, canDrawUp);
  // Đếm theo dữ liệu BE trả về, không theo search chữ — gõ tìm không được làm nhảy tab mặc định. Lỗi tải → không
  // còn chờ dữ liệu nữa, chọn luôn tab mặc định thay vì giữ chỗ mãi.
  const { tab, setTab } = useScheduleTab(
    canDrawUp,
    schedule.isError ? 0 : data?.shortBatches.length,
  );

  if (!canRead) return <LoadErrorState inline error={null} kind="no-read" copy={L.errorCopy} />;
  const options = {
    producers: withCurrent(
      (producers.query.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
      filters.filters.producerId,
    ),
    warehouses: withCurrent(
      (warehouses.data ?? []).map((w) => ({
        value: w.warehouseId,
        label: `${w.code} · ${w.name}`,
      })),
      filters.filters.warehouseId,
    ),
  };
  const headerFilters = scheduleHeaderFilters(filters, options);
  const empty = (title: string, description: string) => (
    <ScheduleEmpty
      filtered={filters.hasFilters}
      title={title}
      description={description}
      onClearFilters={filters.reset}
    />
  );
  return (
    <>
      <ScheduleTabBar
        tab={tab}
        onTabChange={setTab}
        counts={data && { batches: batches.length, orders: orders.length }}
      />
      <ScheduleToolbar
        state={filters}
        columns={tab === "orders" ? columns : undefined}
        {...options}
      />
      <div className="flex flex-col gap-3">
        {filters.rangeInvalid && <Alert tone="danger">{L.rangeInvalid}</Alert>}
        {schedule.isError ? (
          <LoadErrorState
            inline
            error={schedule.error}
            copy={L.errorCopy}
            onRetry={() => void schedule.refetch()}
          />
        ) : !data || tab === null ? (
          <PageSkeleton variant="list" />
        ) : (
          <>
            {data.truncated && <Alert tone="warning">{PRODUCTION_LABELS.drawUp.truncated}</Alert>}
            <div>
              {/* Thanh tải lại nằm trong khoảng 12px phía trên bảng — không tự chiếm thêm một khoảng */}
              <RefetchBar active={schedule.isFetching} label={L.pageTitle} className="-mt-0.5" />
              <ScheduleSections
                tab={tab}
                orders={orders}
                batches={batches}
                headerFilters={headerFilters}
                empty={empty}
                onDrawUp={canDrawUp ? drawUp.pick : undefined}
                visibleColumns={columns.visible}
              />
            </div>
          </>
        )}
      </div>
      {drawUp.open && <DrawUpDialog batch={drawUp.open} onClose={drawUp.close} />}
    </>
  );
}

/**
 * Lịch sản xuất (docs 17 §4.12 bước 47): màn theo dõi Đơn sản xuất đang mở theo ngày cần hàng kèm cờ trễ, và đợt giao
 * còn thiếu chưa có Đơn sản xuất phủ — nơi Điều phối sản xuất bắt đầu lập. Không lập kế hoạch năng lực xưởng.
 * Xem cần `production-schedule:READ` (Quản lý kho chỉ thấy kho mình — BE lọc).
 */
export function ProductionSchedule() {
  return (
    <PermissionBoundary permissions={[PRODUCTION_SCHEDULE_PERMISSIONS.viewPage]} variant="list">
      <div className="surface-soft">
        <h1 className="sr-only">{L.pageTitle}</h1>
        <ScheduleContent />
      </div>
    </PermissionBoundary>
  );
}
