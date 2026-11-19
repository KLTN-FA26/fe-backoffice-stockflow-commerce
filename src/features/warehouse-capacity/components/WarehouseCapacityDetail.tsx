"use client";

import { useState } from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS, WAREHOUSE_CAPACITY_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { isMissingWarehouse } from "@/features/warehouse-capacity/errors";
import { capacityActions } from "@/features/warehouse-capacity/lifecycle";
import { useCapacityBoard, useCapacityBoards } from "@/features/warehouse-capacity/queries";
import { findBoardByCode } from "@/features/warehouse-capacity/selectors";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { CapacityLoadFailed } from "./CapacityLoadFailed";
import { CapacityBreakdown } from "./detail/CapacityBreakdown";
import { CapacityGroups } from "./detail/CapacityGroups";
import { CapacityHeaderCard } from "./detail/CapacityHeaderCard";
import { CapacityStats } from "./detail/CapacityStats";
import { CapacityWarnings } from "./detail/CapacityWarnings";
import { FactorDialog } from "./detail/FactorDialog";

const L = UI_LABELS.warehouseCapacity;

function NotFound() {
  return (
    <EmptyState
      icon={<Gauge className="size-8" />}
      title={L.notFoundTitle}
      description={L.notFoundDescription}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={ADMIN_ROUTES.warehouseCapacity.list}>{L.backToList}</Link>
        </Button>
      }
    />
  );
}

function DetailContent({ prefix }: { prefix: string }) {
  const actions = capacityActions({ can: usePermissionChecker() });
  // URL mang prefix kho (đọc được trên breadcrumb); id lấy từ danh sách — cùng một quyền warehouse-capacity:READ
  const boards = useCapacityBoards(actions.read);
  const listed = findBoardByCode(boards.data, prefix);
  const detail = useCapacityBoard(listed?.warehouseId ?? null, listed);
  const [editing, setEditing] = useState(false);

  if (!actions.read) return <EmptyState title={L.noReadTitle} description={L.noReadDescription} />;
  if (boards.isError && !boards.data)
    return <CapacityLoadFailed error={boards.error} onRetry={() => void boards.refetch()} />;
  if (!boards.data) return <PageSkeleton variant="detail" />;
  if (!listed) return <NotFound />;
  if (detail.isError && isMissingWarehouse(detail.error)) return <NotFound />;
  const board = detail.data ?? listed;

  return (
    <div className="space-y-4">
      <RefetchBar active={detail.isFetching} label={L.refetching} />
      <CapacityHeaderCard board={board} actions={actions} onEditFactor={() => setEditing(true)} />
      <CapacityWarnings board={board} />
      <CapacityStats board={board} />
      <CapacityBreakdown board={board} />
      <CapacityGroups board={board} />
      <p className="text-ink-tertiary text-xs">{L.computedAtRead}</p>
      {actions.editFactor && (
        <FactorDialog warehouseId={board.warehouseId} open={editing} onOpenChange={setEditing} />
      )}
    </div>
  );
}

/**
 * Sức chứa của một kho (docs 06 §4.6 bước 3–4, BR-20): thông tin chung + hệ số sử dụng, bảy cột ở cấp kho, thanh
 * phân bổ, cảnh báo (BR-21, C40) và xem theo zone / kệ / khu. Trang chi tiết kiểu Vercel — không title hiển thị.
 */
export function WarehouseCapacityDetail({ prefix }: { prefix: string }) {
  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">
        {L.detailTitle} {prefix}
      </h1>
      <PermissionBoundary permissions={[WAREHOUSE_CAPACITY_PERMISSIONS.viewPage]} variant="detail">
        <DetailContent prefix={prefix} />
      </PermissionBoundary>
    </div>
  );
}
