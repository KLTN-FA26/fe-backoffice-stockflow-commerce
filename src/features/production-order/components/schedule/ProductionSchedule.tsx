"use client";

import { useState } from "react";
import { CalendarRange, PackageX } from "lucide-react";

import {
  PRODUCER_PERMISSIONS,
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_SCHEDULE_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { todayIso } from "@/lib/date-range";
import { useProducerDirectory } from "@/lib/references/producer-options";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { useProductionSchedule } from "@/features/production-order/queries";
import { byNeedByDate, byWindowStart } from "@/features/production-order/schedule-selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { DetailSection } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { DrawUpDialog } from "../draw-up/DrawUpDialog";
import { ShortBatchTable } from "../draw-up/ShortBatchTable";
import { ScheduledOrdersTable } from "./ScheduledOrdersTable";
import { ScheduleFilters } from "./ScheduleFilters";
import { useScheduleFilters } from "./useScheduleFilters";

import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.schedule;

function ScheduleContent() {
  const can = usePermissionChecker();
  const canRead = can(PRODUCTION_SCHEDULE_PERMISSIONS.read);
  const filters = useScheduleFilters();
  const schedule = useProductionSchedule(filters.params, canRead);
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read));
  const warehouses = useWarehouseDirectory(can(WAREHOUSE_PERMISSIONS.read));
  const [batch, setBatch] = useState<ShortDeliveryBatch | null>(null);
  const canDrawUp = can(PRODUCTION_ORDER_PERMISSIONS.create);

  if (!canRead) return <LoadErrorState inline error={null} kind="no-read" copy={L.errorCopy} />;
  const data = schedule.data;
  return (
    <div className="flex flex-col gap-4">
      <ScheduleFilters
        state={filters}
        producerOptions={(producers.query.data ?? []).map((p) => ({
          value: p.id,
          label: `${p.code} · ${p.name}`,
        }))}
        warehouseOptions={(warehouses.data ?? []).map((w) => ({
          value: w.warehouseId,
          label: `${w.code} · ${w.name}`,
        }))}
      />
      <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{L.description}</p>
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
        <>
          <RefetchBar active={schedule.isFetching} label={L.pageTitle} />
          {data.truncated && <Alert tone="warning">{PRODUCTION_LABELS.drawUp.truncated}</Alert>}
          <DetailSection
            title={`${L.ordersTitle} (${data.productionOrders.length})`}
            icon={CalendarRange}
          >
            <ScheduledOrdersTable rows={byNeedByDate(data.productionOrders)} today={todayIso()} />
          </DetailSection>
          <DetailSection
            title={`${PRODUCTION_LABELS.drawUp.title} (${data.shortBatches.length})`}
            icon={PackageX}
          >
            <ShortBatchTable
              batches={byWindowStart(data.shortBatches)}
              onDrawUp={canDrawUp ? setBatch : undefined}
            />
          </DetailSection>
        </>
      )}
      {batch && <DrawUpDialog batch={batch} onClose={() => setBatch(null)} />}
    </div>
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
