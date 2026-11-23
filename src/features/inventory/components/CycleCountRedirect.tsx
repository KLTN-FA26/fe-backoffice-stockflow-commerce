"use client";

import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useCycleCount } from "../cycle-count-queries";
import { InventoryError } from "./InventoryFeedback";

/** Link cũ `/admin/inventory/cycle-counts/{id}` → phiếu trong tab theo kho của phiếu (spec 2026-11-22 §5.5). */
export function CycleCountRedirect({ id }: { id: string }) {
  const query = useCycleCount(id);
  if (query.isError)
    return <InventoryError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <PageSkeleton variant="detail" />;
  return (
    <WorkspaceRedirect warehouseId={query.data.warehouseId} path={WORKSPACE_PATHS.cycleCount(id)} />
  );
}
