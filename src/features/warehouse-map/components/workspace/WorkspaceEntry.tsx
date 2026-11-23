"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { useAssignedWarehouses } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

const W = UI_LABELS.warehouseMap.workspace;

/**
 * Gốc tab "Kho & bản đồ" (spec 2026-11-22 §5.3): người được gán đúng một kho vào thẳng kho đó; chưa được gán kho nào
 * → báo liên hệ quản trị; còn lại → Danh mục kho để chọn kho (bấm dòng kho).
 */
export function WorkspaceEntry() {
  const router = useRouter();
  const assigned = useAssignedWarehouses();
  const none = assigned.scope === "restricted" && assigned.warehouses.length === 0;
  const only = assigned.scope === "restricted" && assigned.warehouses.length === 1;
  const target = assigned.isLoading
    ? null
    : only
      ? ADMIN_ROUTES.warehouseMap.of(assigned.warehouses[0]?.prefix ?? "")
      : none
        ? null
        : ADMIN_ROUTES.warehouses.list;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (none && !assigned.isLoading) return <EmptyState title={W.noAssignmentTitle} />;
  return <PageSkeleton variant="list" />;
}
