"use client";

import { useState } from "react";

import { LOAD_PLAN_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { loadPlanActions } from "@/features/load-planning/lifecycle";
import { isFinalLoadPlan } from "@/features/load-planning/plan-selectors";
import { useLoadPlan, useLoadPlanLayouts } from "@/features/load-planning/queries";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PlacementEditorGate } from "./editor/PlacementEditorGate";

import { DetailLoadError } from "./detail/DetailLoadError";
import { PlanActions } from "./detail/PlanActions";
import { PlanBody } from "./detail/PlanBody";
import { PlanDialogs } from "./detail/PlanDialogs";
import { PlanHeaderCard } from "./detail/PlanHeaderCard";
import { PlanNotices } from "./detail/PlanNotices";

import type { PlanDialogKind } from "./detail/PlanActions";

function DetailBody({ id }: { id: string }) {
  const canRead = useCan(LOAD_PLAN_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useLoadPlan(id, { enabled: canRead });
  const plan = query.data;
  const hasVehicles = (plan?.vehicles.length ?? 0) > 0;
  const layouts = useLoadPlanLayouts(id, canRead && hasVehicles);
  const warehouses = useWarehouseDirectory(canRead).data;
  const [dialog, setDialog] = useState<PlanDialogKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Chỉnh xếp tay (PR F5): thay phần tab bằng trình soạn tới khi lưu hoặc thoát
  const [editing, setEditing] = useState(false);
  useBreadcrumbLabel(id, plan?.code);

  if (!canRead) return <DetailLoadError error={null} kind="no-read" />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused")
      return <DetailLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    return <PageSkeleton variant="detail" />;
  }
  if (!plan) return <DetailLoadError error={query.error} onRetry={() => void query.refetch()} />;

  const actions = loadPlanActions(plan, { can });
  // Kế hoạch rời PLANNED (người khác chốt / huỷ) hoặc mất quyền: BE từ chối mọi lần lưu, nên đóng trình soạn và báo
  if (editing && !actions.editPlacements) {
    setEditing(false);
    setNotice(UI_LABELS.loadPlan.editor.closedByStatus);
  }
  const warehouse = warehouses?.find((w) => w.warehouseId === plan.warehouseId);
  // Kế hoạch chỉ mang `warehouseId`. Danh mục kho (`/warehouses`) có thể 403 với tài khoản không có quyền kho (điều phối
  // đơn): khi đó "—", không bao giờ hiện UUID thô.
  const warehouseLabel = warehouse
    ? warehouse.code
      ? `${warehouse.code} · ${warehouse.name}`
      : warehouse.name
    : UI_LABELS.loadPlan.detail.unknownWarehouse;
  const final = isFinalLoadPlan(plan.status);

  return (
    <>
      <PlanHeaderCard
        plan={plan}
        warehouseLabel={warehouseLabel}
        actions={
          editing ? null : (
            <PlanActions actions={actions} onOpen={setDialog} onEdit={() => setEditing(true)} />
          )
        }
      />
      <PlanNotices
        plan={plan}
        actions={actions}
        notice={notice}
        refetchFailed={query.isError}
        final={final}
        onRetry={() => void query.refetch()}
        onDismiss={() => setNotice(null)}
      />
      {editing ? (
        <PlacementEditorGate
          plan={plan}
          layouts={layouts.data}
          layoutsFailed={layouts.isError}
          onRetry={() => void layouts.refetch()}
          onExit={() => setEditing(false)}
        />
      ) : (
        <PlanBody
          plan={plan}
          layouts={layouts.data}
          layoutsFailed={layouts.isError}
          actions={actions}
          onNotice={setNotice}
          onAcknowledge={() => setDialog("acknowledge")}
        />
      )}
      <PlanDialogs plan={plan} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

/**
 * Chi tiết kế hoạch xếp xe (docs 09 §4.2 bước 2–4): trạng thái và nút thao tác, số liệu, xe + khung 3D + bảng kiện,
 * khay kiện chưa xếp, đối chiếu. Vào trang cần `fulfillment-load-plans:VIEW_PAGE`, xem cần `:READ`, mọi thao tác cần
 * `:UPDATE` và đúng trạng thái (`loadPlanActions`) — UI-only, Backend phải re-check (BR-13, BR-14, LP-4).
 */
export function LoadPlanDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[LOAD_PLAN_PERMISSIONS.viewPage]} variant="detail">
      <div className="surface-soft surface-compact space-y-4">
        <h1 className="sr-only">{UI_LABELS.loadPlan.pageTitle}</h1>
        <DetailBody id={id} />
      </div>
    </PermissionBoundary>
  );
}
