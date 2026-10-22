"use client";

import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, FULFILLMENT_PACKAGE_PERMISSIONS, UI_LABELS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { transferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import { useTransferPack } from "@/features/fulfillment/transfer-pack-queries";
import { Alert } from "@/components/shared/Alert";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { TransferKitDialog } from "./transfer-pack/TransferKitDialog";
import { TransferPackLines } from "./transfer-pack/TransferPackLines";
import { TransferPackLoadError } from "./transfer-pack/TransferPackLoadError";
import { TransferPackNotices } from "./transfer-pack/TransferPackNotices";
import { TransferPackStart } from "./transfer-pack/TransferPackStart";
import { TransferPackStatusCard } from "./transfer-pack/TransferPackStatusCard";
import { TransferPackagesSection } from "./transfer-pack/TransferPackagesSection";
import { TransferScanSection } from "./transfer-pack/TransferScanSection";
import { useFulfillmentActor } from "./useFulfillmentActor";

const L = UI_LABELS.transferPack;

/** Hộp thoại đóng bộ: `lineId` có = bấm từ bảng dòng (chọn sẵn dòng); `""` = bấm từ nút chung. */
type KitDialogState = { lineId: string } | null;

function StationBody({ transferId }: { transferId: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const [packId, setPackId] = useQueryState("pack", parseAsString);
  const query = useTransferPack(packId, { enabled: canRead });
  const [kit, setKit] = useState<KitDialogState>(null);
  const session = query.data;
  useBreadcrumbLabel(transferId, session?.transferNumber);

  const header = (
    <PageHeader
      title={session ? `${L.stationTitle} — ${session.transferNumber}` : L.stationTitle}
      subtitle={L.subtitle}
      actions={
        <BackLink href={ADMIN_ROUTES.transfers.detail(transferId)} label={L.backToTransfer} />
      }
    />
  );

  if (!canRead) {
    return (
      <>
        {header}
        <TransferPackLoadError error={null} kind="no-read" />
      </>
    );
  }
  if (!packId) {
    return (
      <>
        {header}
        <TransferPackStart
          transferId={transferId}
          actor={actor}
          onOpened={(opened) => void setPackId(opened.packId)}
        />
      </>
    );
  }
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (!session) {
    return (
      <>
        {header}
        <TransferPackLoadError error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const access = transferPackAccess(session, actor);
  const kitLines = session.lines.filter((line) => line.packageCount > 1);

  return (
    <>
      {header}
      {query.isError && (
        <Alert tone="warning" className="mb-3">
          {L.notice.refetchFailed}{" "}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void query.refetch()}
          >
            {UI_LABELS.common.retry}
          </Button>
        </Alert>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <TransferPackNotices session={session} access={access} />
          <TransferPackLines
            session={session}
            onOpenKit={access.canWork ? (lineId) => setKit({ lineId }) : undefined}
          />
          {access.canWork && <TransferScanSection session={session} />}
          <TransferPackagesSection
            session={session}
            access={access}
            onOpenKit={() => setKit({ lineId: "" })}
          />
        </div>
        <div className="space-y-5">
          <TransferPackStatusCard session={session} access={access} actor={actor} />
        </div>
      </div>
      {kit && (
        <TransferKitDialog
          packId={session.packId}
          lines={kitLines}
          initialLineId={kit.lineId || undefined}
          onClose={() => setKit(null)}
        />
      )}
    </>
  );
}

/**
 * Trạm đóng gói của một lệnh chuyển kho nguyên chuyến (SCRUM-287 PR F9, BE `TransferPackController`): mở phiên, quét
 * kiểm hàng của lệnh vào kiện, đóng bộ, giao nguyên thùng, cân đo niêm phong rồi hoàn tất để lập kế hoạch xe. URL giữ
 * `?pack=<packId>` để tải lại trang vẫn vào đúng phiên. Cần `fulfillment-packages:VIEW_PAGE` để vào, `:READ` để xem,
 * `fulfillment-packing:UPDATE` để thao tác — UI-only, Backend phải re-check.
 */
export function TransferPackStation({ transferId }: { transferId: string }) {
  return (
    <FulfillmentPermissionGate
      scope="packing"
      permissions={[FULFILLMENT_PACKAGE_PERMISSIONS.viewPage]}
    >
      <StationBody transferId={transferId} />
    </FulfillmentPermissionGate>
  );
}
