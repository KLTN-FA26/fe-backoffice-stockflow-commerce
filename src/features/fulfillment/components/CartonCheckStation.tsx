"use client";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  PICK_STATUS,
  UI_LABELS,
  WORKSPACE_PATHS,
} from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { InWorkspaceWarehouse, useWorkspaceHref } from "@/lib/workspace";
import { cartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import { useCartonCheckSession } from "@/features/fulfillment/carton-check-queries";
import { useFulfillmentTask } from "@/features/fulfillment/queries";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { CartonCheckNotices } from "./carton-check/CartonCheckNotices";
import { CartonCheckStatusCard } from "./carton-check/CartonCheckStatusCard";
import { CartonLinesSection } from "./carton-check/CartonLinesSection";
import { CartonScanSection } from "./carton-check/CartonScanSection";
import { CartonsSection } from "./carton-check/CartonsSection";
import { ShipmentsSection } from "./carton-check/ShipmentsSection";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { taskCode } from "./primitives";
import { useFulfillmentActor } from "./useFulfillmentActor";

import type { CartonLpnLabelSlot } from "@/features/fulfillment/lpn-label-slot";

const { common, cartonCheck } = UI_LABELS;

function CartonCheckStationBody({
  id,
  lpnLabelSlot,
}: {
  id: string;
  lpnLabelSlot?: CartonLpnLabelSlot;
}) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const sessionQuery = useCartonCheckSession(id, { enabled: canRead });
  // Trạng thái lấy hàng tách khỏi phiên: thùng còn ở khu chờ xuất (task STAGED) thì chưa bắt đầu kiểm được
  const taskQuery = useFulfillmentTask(id, {
    enabled: canRead && actor.can(FULFILLMENT_PICK_PERMISSIONS.read),
  });
  const session = sessionQuery.data;
  const listHref = useWorkspaceHref()(WORKSPACE_PATHS.packing);
  useBreadcrumbLabel(id, session ? (session.orderNumber ?? taskCode(session)) : undefined);

  if (!canRead)
    return <FulfillmentLoadError scope="packing" error={null} kind="no-read" listHref={listHref} />;
  if (sessionQuery.isPending) return <PageSkeleton variant="detail" />;
  if (sessionQuery.isError && !session) {
    return (
      <FulfillmentLoadError
        scope="packing"
        error={sessionQuery.error}
        onRetry={() => void sessionQuery.refetch()}
        listHref={listHref}
      />
    );
  }
  if (!session) return <PageSkeleton variant="detail" />;

  const access = cartonCheckAccess(session, actor);
  const task = taskQuery.data;
  // Chưa lấy hàng xong thì chưa bắt đầu được (BE `PACKING_NOT_READY`) — chỉ biết khi đọc được task
  const waitingPick = access.canStart && !!task && task.pickStatus !== PICK_STATUS.PICKED;

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số đơn và link về hàng chờ; số đơn nằm ở đầu thẻ trạng thái.
    // Phiên của kho khác kho trên URL → chuyển sang đúng kho (spec 2026-11-22 §2)
    <InWorkspaceWarehouse warehouseId={session.warehouseId} path={WORKSPACE_PATHS.packingTask(id)}>
      <div className="surface-soft surface-compact">
        <h1 className="sr-only">{`${cartonCheck.stationTitle} — ${session.orderNumber ?? taskCode(session)}`}</h1>
        {sessionQuery.isError && (
          <Alert tone="warning" className="mb-3 print:hidden">
            {cartonCheck.notice.refetchFailed}{" "}
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <CartonCheckNotices session={session} access={access} waitingPick={waitingPick} />
            {/* Ô quét lên trên bảng dòng: trên máy tính bảng không phải cuộn qua bảng mới thấy chỗ quét (S01-12) */}
            {access.canWork && <CartonScanSection session={session} />}
            <CartonLinesSection session={session} />
            <CartonsSection session={session} access={access} lpnLabelSlot={lpnLabelSlot} />
            <ShipmentsSection session={session} />
          </div>
          {/* Màn hẹp (một cột): thẻ trạng thái + nút Bắt đầu / Hoàn tất lên đầu, không nằm cuối trang (S01-12) */}
          <div className="order-first space-y-5 xl:order-none">
            <CartonCheckStatusCard
              session={session}
              access={access}
              actor={actor}
              waitingPick={waitingPick}
            />
          </div>
        </div>
      </div>
    </InWorkspaceWarehouse>
  );
}

/**
 * Trạm kiểm thùng & dán nhãn giao hàng của một task (BE 4C-6, docs 08): bắt đầu phiên, quét LPN từng thùng, dán nhãn và
 * in PDF nhãn giao hàng, in lại nhãn, loại thùng hư hỏng và hoàn tất thành shipment (đủ thùng hoặc giao một phần).
 * `lpnLabelSlot`: hộp thoại in lại nhãn LPN của thùng (docs 08 §6), do chỗ ghép truyền vào.
 */
export function CartonCheckStation({
  id,
  lpnLabelSlot,
}: {
  id: string;
  lpnLabelSlot?: CartonLpnLabelSlot;
}) {
  return (
    <FulfillmentPermissionGate
      scope="packing"
      permissions={[FULFILLMENT_PACKAGE_PERMISSIONS.viewPage]}
    >
      <CartonCheckStationBody id={id} lpnLabelSlot={lpnLabelSlot} />
    </FulfillmentPermissionGate>
  );
}
