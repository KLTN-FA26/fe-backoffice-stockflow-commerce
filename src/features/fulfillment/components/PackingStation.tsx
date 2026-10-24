"use client";

import { parseAsString, useQueryState } from "nuqs";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  ORDER_PERMISSIONS,
  PICK_STATUS,
  UI_LABELS,
} from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { canDownloadArtifact } from "@/features/fulfillment/lifecycle";
import { packingAccess } from "@/features/fulfillment/packing-lifecycle";
import { usePackingSession } from "@/features/fulfillment/packing-queries";
import { hasPrintLines, printLinesWaiting } from "@/features/fulfillment/packing-selectors";
import { useFulfillmentOrder, useFulfillmentTask } from "@/features/fulfillment/queries";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { DesignLinesSection } from "./packing/DesignLinesSection";
import { EvidenceTable } from "./packing/EvidenceTable";
import { PackageLabelView } from "./packing/PackageLabelView";
import { PackagesSection } from "./packing/PackagesSection";
import { PackingLinesSection } from "./packing/PackingLinesSection";
import { PackingNotices } from "./packing/PackingNotices";
import { PackingStatusCard } from "./packing/PackingStatusCard";
import { ScanSection } from "./packing/ScanSection";
import { ShipmentsSection } from "./packing/ShipmentsSection";
import { Section, taskCode } from "./primitives";
import { useFulfillmentActor } from "./useFulfillmentActor";

const { common, packing } = UI_LABELS;

function PackingStationBody({ id }: { id: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  // Chỉ để đọc cờ `printLinesReady` của đơn (BE PR #150): dòng thiết kế đã đi kèm task (SCRUM-466)
  const canReadOrders = actor.can(ORDER_PERMISSIONS.read);
  const [labelId, setLabelId] = useQueryState("label", parseAsString);
  const sessionQuery = usePackingSession(id, { enabled: canRead });
  // Task (thiết kế đã khoá, lịch sử đối chiếu, trạng thái lấy hàng) tách khỏi phiên
  const taskQuery = useFulfillmentTask(id, {
    enabled: canRead && actor.can(FULFILLMENT_PICK_PERMISSIONS.read),
  });
  const order = useFulfillmentOrder(taskQuery.data?.orderId, canReadOrders);
  const session = sessionQuery.data;
  useBreadcrumbLabel(id, session ? (session.orderNumber ?? taskCode(session.taskId)) : undefined);

  if (!canRead) return <FulfillmentLoadError scope="packing" error={null} kind="no-read" />;
  if (sessionQuery.isPending) return <PageSkeleton variant="detail" />;
  if (sessionQuery.isError && !session) {
    return (
      <FulfillmentLoadError
        scope="packing"
        error={sessionQuery.error}
        onRetry={() => void sessionQuery.refetch()}
      />
    );
  }
  if (!session) return <PageSkeleton variant="detail" />;

  const access = packingAccess(session, actor);
  const task = taskQuery.data;
  const skuByLine = Object.fromEntries(session.lines.map((line) => [line.orderLineId, line.sku]));
  // Chưa lấy hàng xong thì chưa nhận đơn được (BE `PACKING_NOT_READY`) — chỉ biết khi đọc được task
  const waitingPick = access.canStart && !!task && task.pickStatus !== PICK_STATUS.PICKED;
  const showDesign = hasPrintLines(session) || (task?.integrityEvidence.length ?? 0) > 0;
  // Hàng in chưa về bàn đóng gói (BE PR #150, PACK-EARLY): cờ của đơn khi đọc được, không thì suy từ phiên
  const printWaiting = printLinesWaiting(session, order.data?.printLinesReady);

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số đơn và link về hàng chờ; số đơn nằm ở đầu thẻ trạng thái.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${packing.stationTitle} — ${session.orderNumber ?? taskCode(session.taskId)}`}</h1>
      {sessionQuery.isError && (
        <Alert tone="warning" className="mb-3 print:hidden">
          {packing.notice.refetchFailed}{" "}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void sessionQuery.refetch()}
          >
            {common.retry}
          </Button>
        </Alert>
      )}
      {labelId ? (
        <PackageLabelView
          taskId={session.taskId}
          packageId={labelId}
          onBack={() => void setLabelId(null)}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-5">
            <PackingNotices
              session={session}
              access={access}
              waitingPick={waitingPick}
              printLinesWaiting={printWaiting}
            />
            <PackingLinesSection session={session} printLinesWaiting={printWaiting} />
            {access.canWork && <ScanSection session={session} />}
            <PackagesSection
              session={session}
              access={access}
              onShowLabel={(packageId) => void setLabelId(packageId)}
            />
            <ShipmentsSection session={session} />
            {showDesign && task && (
              <>
                <DesignLinesSection task={task} canDownload={canDownloadArtifact(task, actor)} />
                <Section
                  title="Lịch sử đối chiếu thiết kế"
                  description="Mỗi lần hoàn tất đóng gói hoặc kiểm tra lại, hệ thống ghi một bản cho mỗi dòng tuỳ chỉnh."
                >
                  <EvidenceTable evidence={task.integrityEvidence} skuByLine={skuByLine} />
                </Section>
              </>
            )}
          </div>
          <div className="space-y-5">
            <PackingStatusCard
              session={session}
              access={access}
              actor={actor}
              waitingPick={waitingPick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trạm đóng gói của một task (BE PR #136): nhận đơn, quét kiểm vào kiện, cân đo niêm phong, in nhãn
 * và hoàn tất thành lô giao; giữ nguyên phần đối chiếu thiết kế đã khoá của dòng in (flow X-CHK).
 */
export function PackingStation({ id }: { id: string }) {
  return (
    <FulfillmentPermissionGate
      scope="packing"
      permissions={[FULFILLMENT_PACKAGE_PERMISSIONS.viewPage]}
    >
      <PackingStationBody id={id} />
    </FulfillmentPermissionGate>
  );
}
