"use client";

import { ADMIN_ROUTES, TRANSFER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useTransferOrder } from "@/features/transfer/queries";
import { isPartialDispatch } from "@/features/transfer/selectors";
import { Alert } from "@/components/shared/Alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BackLink } from "@/components/shared/BackLink";

import { TransferActions } from "./detail/TransferActions";
import { TransferInfo, TransferTimelineCard } from "./detail/TransferInfo";
import { TransferLinesTable } from "./detail/TransferLinesTable";
import { RefetchErrorNotice, Section } from "./primitives";
import { TransferLoadError } from "./TransferLoadError";
import { TransferPermissionGate } from "./TransferPermissionGate";

const L = UI_LABELS.transfer;

function TransferDetailBody({ id }: { id: string }) {
  const canRead = useCan(TRANSFER_PERMISSIONS.read);
  const query = useTransferOrder(id, { enabled: canRead });
  // Breadcrumb hiện số lệnh thay vì UUID
  useBreadcrumbLabel(id, query.data?.number);

  if (!canRead) return <TransferLoadError error={null} kind="no-read" />;
  // Chưa có dữ liệu (lần đầu, hoặc bấm Thử lại ở màn lỗi): mất mạng → báo mạng, đang tải → skeleton
  // (không để màn lỗi cũ đứng yên trong lúc đang tải lại)
  if (!query.data) {
    if (query.fetchStatus === "paused") {
      return <TransferLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    if (query.isPending || query.isFetching) return <PageSkeleton variant="detail" />;
  }
  const transfer = query.data;
  if (!transfer) {
    return <TransferLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title={transfer.number}
        subtitle={L.pageTitle}
        actions={<BackLink href={ADMIN_ROUTES.transfers.list} />}
      />
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <TransferInfo transfer={transfer} />
          <Section title={L.sectionLines}>
            {isPartialDispatch(transfer) && (
              <Alert tone="warning" className="mb-3">
                {L.partialDispatch}
              </Alert>
            )}
            <TransferLinesTable transfer={transfer} />
          </Section>
        </div>
        <div className="space-y-5">
          <TransferActions transfer={transfer} />
          <TransferTimelineCard transfer={transfer} />
        </div>
      </div>
    </>
  );
}

export function TransferDetail({ id }: { id: string }) {
  return (
    <TransferPermissionGate permissions={[TRANSFER_PERMISSIONS.viewPage]}>
      <TransferDetailBody id={id} />
    </TransferPermissionGate>
  );
}
