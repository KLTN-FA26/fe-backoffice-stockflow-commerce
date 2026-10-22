"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES, PRODUCTION_ORDER_PERMISSIONS } from "@/constants";

import { useCan, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { allowedProductionActions } from "@/features/production-order/lifecycle";
import { useProductionOrder } from "@/features/production-order/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { PRODUCTION_COPY, TYPE_LABEL } from "./copy";
import { IssuePanel } from "./detail/IssuePanel";
import { PrintFileCard } from "./detail/PrintFileCard";
import { ProductionActions } from "./detail/ProductionActions";
import { QcPanel } from "./detail/QcPanel";
import { SubcontractPanel } from "./detail/SubcontractPanel";
import { Overview, HistoryAndScrap } from "./detail/OverviewCards";

function ProductionDetailContent({ id }: { id: string }) {
  const canRead = useCan(PRODUCTION_ORDER_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useProductionOrder(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.summary.orderNumber);
  const back = { href: ADMIN_ROUTES.productionOrders.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={PRODUCTION_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={PRODUCTION_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const order = query.data;
  const s = order.summary;
  // Panel thao tác tại chỗ chỉ mở khi bảng vòng đời cho phép (allowedProductionActions).
  const actions = allowedProductionActions(order, can);
  return (
    <>
      <PageHeader
        title={`LSX ${s.orderNumber}`}
        subtitle={`${TYPE_LABEL[s.type]} · tạo ${formatDateTime(s.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={ADMIN_ROUTES.productionOrders.list}>
                <ArrowLeft className="size-3.5" /> Danh sách
              </Link>
            </Button>
            <ProductionActions order={order} />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Overview order={order} />
          {s.mode === "IN_HOUSE" && <IssuePanel order={order} active={actions.includes("issue")} />}
          <QcPanel order={order} active={actions.includes("qc")} />
          <SubcontractPanel order={order} />
        </div>
        <div className="space-y-4">
          <PrintFileCard order={order} />
          <HistoryAndScrap order={order} />
        </div>
      </div>
    </>
  );
}

export function ProductionDetailView({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.viewPage]}>
      <ProductionDetailContent id={id} />
    </PermissionBoundary>
  );
}
