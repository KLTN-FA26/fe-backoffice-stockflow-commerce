"use client";

import { PRODUCTION_LABELS, PRODUCTION_ORDER_PERMISSIONS } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { productionOrderActions } from "@/features/production-order/lifecycle";
import {
  useProductionOrder,
  useProductionOrderDispatch,
} from "@/features/production-order/queries";

import { DelayAlertsPanel } from "@/components/backoffice/DelayAlertsPanel";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DETAIL_GRID_CLASS } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { ActionsCard } from "./detail/ActionsCard";
import { CapacityWarning } from "./detail/CapacityWarning";
import { DispatchCard } from "./detail/DispatchCard";
import { GeneralCard } from "./detail/GeneralCard";
import { HistoryCard } from "./detail/HistoryCard";
import { LinesCard } from "./detail/LinesCard";
import { SampleRoundsCard } from "./sample/SampleRoundsCard";

const COPY = PRODUCTION_LABELS.order.errorCopy;

function DetailContent({ id }: { id: string }) {
  const can = usePermissionChecker();
  const me = useAuthStore((state) => state.user?.userId);
  const canRead = can(PRODUCTION_ORDER_PERMISSIONS.read);
  const query = useProductionOrder(id, { enabled: canRead });
  const order = query.data;
  // Chỉ khi gửi mới có phiếu và mail cho đơn vị sản xuất (BE ghi `sentAt`) — đơn huỷ từ nháp chưa gửi gì, không gọi `/dispatch`
  // (docs 17 §4.3 bước 7).
  const sent = Boolean(order?.sentAt);
  const dispatch = useProductionOrderDispatch(id, 0, canRead && sent);
  useBreadcrumbLabel(id, order?.code);

  if (!canRead) return <LoadErrorState inline error={null} kind="no-read" copy={COPY} />;
  if (query.isError)
    return (
      <LoadErrorState inline error={query.error} copy={COPY} onRetry={() => void query.refetch()} />
    );
  if (!order) return <PageSkeleton variant="detail" />;

  const actions = productionOrderActions(order, { can }, dispatch.data?.channel);
  return (
    <>
      <RefetchBar active={query.isFetching} label={PRODUCTION_LABELS.detail.loadingRefs} />
      <div className={DETAIL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <DelayAlertsPanel salesOrderId={order.salesOrderId} productionOrderId={order.id} />
          <CapacityWarning order={order} />
          <GeneralCard order={order} me={me} />
          <LinesCard order={order} />
          <SampleRoundsCard order={order} />
          {dispatch.data && (
            <DispatchCard order={order} dispatch={dispatch.data} canResend={actions.resend} />
          )}
        </div>
        <aside className="flex flex-col gap-5">
          <ActionsCard order={order} actions={actions} dispatch={dispatch.data} />
          <HistoryCard history={order.history ?? []} me={me} />
        </aside>
      </div>
    </>
  );
}

/**
 * Chi tiết Đơn sản xuất (docs 17 §4.3, §5.3) — style Vercel loại "Chi tiết": không title hiển thị, mã ở "Thông tin
 * chung" + breadcrumb. Nút thao tác theo `productionOrderActions` (trạng thái × quyền × người lập).
 */
export function ProductionOrderDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.viewPage]} variant="detail">
      <div className="surface-soft surface-compact">
        <h1 className="sr-only">{PRODUCTION_LABELS.order.pageTitle}</h1>
        <DetailContent id={id} />
      </div>
    </PermissionBoundary>
  );
}
