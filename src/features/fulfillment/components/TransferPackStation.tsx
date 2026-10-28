"use client";

import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, FULFILLMENT_PACKAGE_PERMISSIONS, UI_LABELS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { transferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import {
  useCurrentTransferPack,
  useTransferPack,
} from "@/features/fulfillment/transfer-pack-queries";
import { ApiError } from "@/lib/api/error";
import { Alert } from "@/components/shared/Alert";
import { BackLink } from "@/components/shared/BackLink";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { TransferPackLoadError } from "./transfer-pack/TransferPackLoadError";
import { TransferPackageLabelView } from "./transfer-pack/TransferPackageLabelView";
import { TransferPackStart } from "./transfer-pack/TransferPackStart";
import { TransferPackWorkArea } from "./transfer-pack/TransferPackWorkArea";
import { useFulfillmentActor } from "./useFulfillmentActor";

const L = UI_LABELS.transferPack;

function StationBody({ transferId }: { transferId: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const [packId, setPackId] = useQueryState("pack", parseAsString);
  const [labelId, setLabelId] = useQueryState("label", parseAsString);
  // Có ?pack → đọc đúng phiên đó; không có → TRA phiên hiện hành của lệnh (BE `GET ?transferOrderId=`, không mở gì) để
  // người chỉ có packages:READ và người quay lại sau khi đã đóng xong vào thẳng phiên. 404 = chưa từng đóng gói
  const byPack = useTransferPack(packId, { enabled: canRead });
  const current = useCurrentTransferPack(transferId, { enabled: canRead && !packId });
  const query = packId ? byPack : current;
  const session = query.data;
  useBreadcrumbLabel(transferId, session?.transferNumber);

  // Kiểu Vercel: không tiêu đề hiển thị (h1 sr-only). Breadcrumb của trạm không dẫn về lệnh chuyển nên giữ
  // link "Về lệnh chuyển" thành một dòng nhỏ góc phải.
  const header = (
    <>
      <h1 className="sr-only">
        {session ? `${L.stationTitle} — ${session.transferNumber}` : L.stationTitle}
      </h1>
      <div className="mb-3 flex justify-end">
        <BackLink href={ADMIN_ROUTES.transfers.detail(transferId)} label={L.backToTransfer} />
      </div>
    </>
  );

  if (!canRead) {
    return (
      <>
        {header}
        <TransferPackLoadError error={null} kind="no-read" />
      </>
    );
  }
  const neverPacked = !packId && current.error instanceof ApiError && current.error.status === 404;
  if (neverPacked) {
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
  const labelParcel = labelId ? session.packages.find((p) => p.packageId === labelId) : undefined;

  // Nhãn thay vùng nội dung (`?label=` trên URL); khung back-office ẩn khi in nên `window.print()` ra đúng tờ nhãn
  if (labelId) {
    return (
      <>
        <div className="print:hidden">{header}</div>
        <TransferPackageLabelView
          packId={session.packId}
          packageId={labelId}
          wasOutdated={!!labelParcel?.labelOutdated}
          onBack={() => void setLabelId(null)}
        />
      </>
    );
  }

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
      <TransferPackWorkArea
        session={session}
        access={access}
        actor={actor}
        onShowLabel={(packageId) => void setLabelId(packageId)}
      />
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
      {/* Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`) */}
      <div className="surface-soft surface-compact">
        <StationBody transferId={transferId} />
      </div>
    </FulfillmentPermissionGate>
  );
}
