"use client";

import { WORKSPACE_PATHS } from "@/constants";
import { useFulfillmentTask } from "@/features/fulfillment/queries";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { CartonCheckRedirect } from "./carton-check/CartonCheckRedirect";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { TaskWorkspaceRedirect } from "./TaskWorkspaceRedirect";

import type { FulfillmentScope } from "./primitives";

/**
 * Link cũ `/admin/picking/{id}` / `/admin/packing/{id}` (từ Đơn hàng, cất lại…) → task trong tab theo kho của task
 * (spec 2026-11-22 §5.5). Kho = kho xuất của đơn (07 BR-07: mỗi đơn một task, tại một kho).
 */
export function PickingTaskRedirect({
  id,
  scope = "picking",
}: {
  id: string;
  /** Màn đích: lấy hàng hoặc trạm kiểm thùng của cùng task. */
  scope?: FulfillmentScope;
}) {
  // Trạm kiểm thùng đọc kho từ phiên (không cần quyền lấy hàng)
  if (scope === "packing") return <CartonCheckRedirect id={id} />;
  return <PickingRedirect id={id} />;
}

function PickingRedirect({ id }: { id: string }) {
  const query = useFulfillmentTask(id);
  if (query.isError)
    return (
      <FulfillmentLoadError
        scope="picking"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data) return <PageSkeleton variant="detail" />;
  return (
    <TaskWorkspaceRedirect
      warehouseId={query.data.warehouseId}
      locationCode={query.data.stagingLocationCode}
      path={WORKSPACE_PATHS.pickingTask(id)}
    />
  );
}
