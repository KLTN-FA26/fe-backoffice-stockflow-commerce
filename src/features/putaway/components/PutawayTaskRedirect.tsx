"use client";

import { PUTAWAY_LABELS, WORKSPACE_PATHS } from "@/constants";
import { prefixOfLocation, WorkspaceRedirect } from "@/lib/workspace";
import { usePutawayTask } from "@/features/putaway/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/**
 * Link cũ `/admin/putaway/{taskId}` → nhiệm vụ trong tab theo kho (spec 2026-11-22 §5.5). Kho lấy từ `warehouseId` của
 * nhiệm vụ (BE #394); BE cũ chưa trả thì lấy prefix kho từ mã vị trí thùng đang đứng (06 BR-10: mã vị trí bắt đầu bằng
 * prefix kho).
 */
export function PutawayTaskRedirect({ taskId }: { taskId: string }) {
  const query = usePutawayTask(taskId);
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={PUTAWAY_LABELS.errorCopy}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data) return <PageSkeleton variant="detail" />;
  const path = WORKSPACE_PATHS.putawayTask(taskId);
  return query.data.warehouseId ? (
    <WorkspaceRedirect warehouseId={query.data.warehouseId} path={path} />
  ) : (
    <WorkspaceRedirect prefix={prefixOfLocation(query.data.sourceLocationCode)} path={path} />
  );
}
