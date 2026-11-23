"use client";

import { WORKSPACE_PATHS } from "@/constants";
import { useCartonCheckSession } from "@/features/fulfillment/carton-check-queries";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { FulfillmentLoadError } from "../FulfillmentLoadError";
import { TaskWorkspaceRedirect } from "../TaskWorkspaceRedirect";

/**
 * Link cũ `/admin/packing/{id}` → trạm kiểm thùng trong tab theo kho (spec 2026-11-22 §5.5). Kho đọc từ phiên kiểm thùng
 * (`CartonCheckSessionResponse.warehouseId`) — role chỉ có quyền kiểm thùng (không có quyền lấy hàng) vẫn đi được.
 */
export function CartonCheckRedirect({ id }: { id: string }) {
  const query = useCartonCheckSession(id, { enabled: true });
  if (query.isError)
    return (
      <FulfillmentLoadError
        scope="packing"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data) return <PageSkeleton variant="detail" />;
  return (
    <TaskWorkspaceRedirect
      warehouseId={query.data.warehouseId}
      path={WORKSPACE_PATHS.packingTask(id)}
    />
  );
}
