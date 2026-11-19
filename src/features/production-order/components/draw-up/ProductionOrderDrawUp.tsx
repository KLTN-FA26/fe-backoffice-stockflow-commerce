"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import {
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_SCHEDULE_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useProductionSchedule } from "@/features/production-order/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { Card } from "@/components/shared/Card";
import { DetailCardTitle } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { DrawUpDialog } from "./DrawUpDialog";
import { ShortBatchTable } from "./ShortBatchTable";

import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.drawUp;

function DrawUpContent() {
  const canRead = useCan(PRODUCTION_SCHEDULE_PERMISSIONS.read);
  const schedule = useProductionSchedule({}, canRead);
  const [batch, setBatch] = useState<ShortDeliveryBatch | null>(null);

  if (!canRead)
    return (
      <LoadErrorState
        inline
        error={null}
        kind="no-read"
        copy={PRODUCTION_LABELS.schedule.errorCopy}
      />
    );
  if (schedule.isError)
    return (
      <LoadErrorState
        inline
        error={schedule.error}
        copy={PRODUCTION_LABELS.schedule.errorCopy}
        onRetry={() => void schedule.refetch()}
      />
    );
  if (schedule.isPending) return <PageSkeleton variant="list" />;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <DetailCardTitle>{L.title}</DetailCardTitle>
          <p className="text-ink-secondary mt-1 max-w-[68ch] text-[0.8125rem]">{L.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void schedule.refetch()}
          disabled={schedule.isFetching}
        >
          <RotateCcw className="size-3.5" /> {L.refresh}
        </Button>
      </div>
      <RefetchBar active={schedule.isFetching} label={L.title} />
      {schedule.data.truncated && <Alert tone="warning">{L.truncated}</Alert>}
      <ShortBatchTable batches={schedule.data.shortBatches} onDrawUp={setBatch} />
      {batch && <DrawUpDialog batch={batch} onClose={() => setBatch(null)} />}
    </Card>
  );
}

/**
 * Lập Đơn sản xuất (docs 17 §4.3 bước 6): không có form tạo trắng — chọn một đợt giao còn thiếu, chọn đơn vị sản xuất.
 * Cần `production-orders:CREATE` (Điều phối sản xuất) và `production-schedule:READ` để thấy đợt còn thiếu.
 * UI-only — Backend phải re-check (BR-05).
 */
export function ProductionOrderDrawUp() {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.create]} variant="list">
      <div className="surface-soft surface-compact">
        <h1 className="sr-only">{PRODUCTION_LABELS.order.createPageTitle}</h1>
        <DrawUpContent />
      </div>
    </PermissionBoundary>
  );
}
