"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { ADMIN_ROUTES, LOAD_PLAN_PERMISSIONS, UI_LABELS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { loadPlanActions } from "../lifecycle";

import { buildLoadPlanColumns } from "./list/columns";
import { LoadPlanFilters } from "./list/LoadPlanFilters";
import { LoadPlanListBody } from "./list/LoadPlanListBody";
import { useLoadPlanListState } from "./list/useLoadPlanListState";

const L = UI_LABELS.loadPlan;

function LoadPlanListContent() {
  const canRead = useCan(LOAD_PLAN_PERMISSIONS.read);
  const can = usePermissionChecker();
  const s = useLoadPlanListState(canRead);
  const canCreate = loadPlanActions(null, { can }).create;
  const createAction = canCreate && (
    <Button
      size="sm"
      asChild
      className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
    >
      <Link href={ADMIN_ROUTES.loadPlans.create}>
        <Plus className="size-3.5" /> {L.create}
      </Link>
    </Button>
  );

  return (
    // Giao diện kiểu Vercel (`.surface-soft`): không title hiển thị — tên trang nằm ở breadcrumb topbar
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && <LoadPlanFilters s={s} actions={createAction} />}
      <LoadPlanListBody s={s} columns={buildLoadPlanColumns()} createAction={createAction} />
    </div>
  );
}

/**
 * Danh sách kế hoạch xếp xe (docs 09 §4.2): lô giao nguyên xe chờ xuất → kế hoạch → chuyến xe. Vào trang cần
 * `fulfillment-load-plans:VIEW_PAGE`, xem cần `:READ`, lập mới cần `:CREATE` (UI-only — Backend phải re-check).
 */
export function LoadPlanList() {
  return (
    <PermissionBoundary permissions={[LOAD_PLAN_PERMISSIONS.viewPage]} variant="list">
      <LoadPlanListContent />
    </PermissionBoundary>
  );
}
