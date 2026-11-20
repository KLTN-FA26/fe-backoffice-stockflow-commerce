"use client";

import { useState } from "react";

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

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { DrawUpDialog } from "../draw-up/DrawUpDialog";
import { ScheduleEmpty } from "./ScheduleEmpty";
import { scheduleHeaderFilters, withCurrent } from "./ScheduleHeaderFilters";
import { ScheduleSections } from "./ScheduleSections";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { useScheduleColumns } from "./useScheduleColumns";
import { useScheduleFilters } from "./useScheduleFilters";

import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.schedule;

function ScheduleContent() {
  const can = usePermissionChecker();
  const canRead = can(PRODUCTION_SCHEDULE_PERMISSIONS.read);
  const filters = useScheduleFilters();
  const columns = useScheduleColumns();
  const schedule = useProductionSchedule(filters.params, canRead);
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read));
  const warehouses = useWarehouseDirectory(can(WAREHOUSE_PERMISSIONS.read));
  const [batch, setBatch] = useState<ShortDeliveryBatch | null>(null);
  const canDrawUp = can(PRODUCTION_ORDER_PERMISSIONS.create);

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
  const data = schedule.data;
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
      <ScheduleToolbar state={filters} columns={columns} {...options} />
      <div className="flex flex-col gap-4">
        {filters.rangeInvalid && <Alert tone="danger">{L.rangeInvalid}</Alert>}
        {schedule.isError ? (
          <LoadErrorState
            inline
            error={schedule.error}
            copy={L.errorCopy}
            onRetry={() => void schedule.refetch()}
          />
        ) : !data ? (
          <PageSkeleton variant="list" />
        ) : (
          <ScheduleSections
            data={data}
            filters={filters}
            headerFilters={headerFilters}
            empty={empty}
            onDrawUp={canDrawUp ? setBatch : undefined}
            isFetching={schedule.isFetching}
            visibleColumns={columns.visible}
          />
        )}
      </div>
      {batch && <DrawUpDialog batch={batch} onClose={() => setBatch(null)} />}
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
