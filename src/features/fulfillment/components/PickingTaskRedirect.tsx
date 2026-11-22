"use client";

import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";
import { useFulfillmentTask } from "@/features/fulfillment/queries";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { FulfillmentLoadError } from "./FulfillmentLoadError";

/**
 * Link cũ `/admin/picking/{id}` (từ Đơn hàng, cất lại…) → task trong tab theo kho của task (spec 2026-11-22 §5.5).
 * Kho = kho xuất của đơn (07 BR-07: mỗi đơn một task, tại một kho).
 */
export function PickingTaskRedirect({ id }: { id: string }) {
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
    <WorkspaceRedirect
      warehouseId={query.data.warehouseId}
      path={WORKSPACE_PATHS.pickingTask(id)}
    />
  );
}
