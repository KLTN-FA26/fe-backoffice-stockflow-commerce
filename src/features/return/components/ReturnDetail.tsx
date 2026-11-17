"use client";

import Link from "next/link";
import { ArrowLeft, PackageOpen } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES, RMA_PERMISSIONS } from "@/constants/returns";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedReturnActions } from "../lifecycle";
import { useReturn } from "../queries";

import { RETURN_COPY } from "./primitives";
import { ReturnActions } from "./ReturnActions";
import { ReturnEvidenceCard } from "./ReturnEvidenceCard";
import { ReturnHistoryCard } from "./ReturnHistoryCard";
import { RefundActions } from "./RefundActions";
import { ReturnLinesCard } from "./ReturnLinesCard";
import { ReturnGeneralCard, ReturnProgressCard } from "./ReturnSummary";

const L = RETURN_LABELS;

function ReturnDetailContent({ id }: { id: string }) {
  const canRead = useCan(RMA_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useReturn(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.rmaNumber);
  const back = { href: RETURN_ROUTES.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={RETURN_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={RETURN_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const ret = query.data;
  // UI-only — Backend phải re-check (sales-rmas / sales-rma-resolutions / procurement-goods-receipts)
  const actions = allowedReturnActions(ret, can);

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${L.pageTitle} ${ret.rmaNumber}`}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={RETURN_ROUTES.list}>
            <ArrowLeft className="size-3.5" /> {L.pageTitle}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {actions.includes("createReceipt") && (
            <Button asChild size="sm">
              <Link href={RETURN_ROUTES.receipts.createFor(ret.id)}>
                <PackageOpen className="size-3.5" /> {L.actions.createReceipt}
              </Link>
            </Button>
          )}
          <RefundActions ret={ret} actions={actions} />
          <ReturnActions ret={ret} actions={actions} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <ReturnLinesCard ret={ret} />
          <ReturnEvidenceCard ret={ret} />
          <ReturnHistoryCard history={ret.history ?? []} />
        </div>
        <div className="space-y-4">
          <ReturnGeneralCard ret={ret} />
          <ReturnProgressCard ret={ret} />
        </div>
      </div>
    </div>
  );
}

/**
 * Chi tiết một yêu cầu trả hàng (docs 17 §4.10): dòng yêu cầu / duyệt / đã về / hoàn, ảnh bằng chứng, quyết định của
 * Sale, hàng về kho, hoàn tiền và lịch sử. Nút theo trạng thái + quyền (`allowedReturnActions`).
 */
export function ReturnDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[RMA_PERMISSIONS.viewPage]}>
      <ReturnDetailContent id={id} />
    </PermissionBoundary>
  );
}
