"use client";

import { ADMIN_ROUTES, FULFILLMENT_PICK_PERMISSIONS, UI_LABELS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useFulfillmentTask } from "@/features/fulfillment/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BackLink } from "@/components/shared/BackLink";

import { OrderLinesSection } from "./detail/OrderLinesSection";
import { TaskInfo } from "./detail/TaskInfo";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { PickingWorkArea } from "./picking/PickingWorkArea";
import { orderLabel, taskCode } from "./primitives";
import { useFulfillmentActor } from "./useFulfillmentActor";

const { fulfillment } = UI_LABELS;

function PickingDetailBody({ id }: { id: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const query = useFulfillmentTask(id, { enabled: canRead });
  // Breadcrumb hiện mã rút gọn thay vì UUID đầy đủ
  useBreadcrumbLabel(id, query.data ? taskCode(query.data.taskId) : undefined);

  if (!canRead) return <FulfillmentLoadError scope="picking" error={null} kind="no-read" />;
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) {
    return (
      <FulfillmentLoadError
        scope="picking"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const task = query.data;
  const orderNumber = task.orderNumber ?? undefined;

  return (
    <>
      <PageHeader
        title={`Task ${taskCode(task.taskId)}`}
        subtitle={`${fulfillment.pickingTitle} · Đơn ${orderLabel(task.orderId, orderNumber)}`}
        actions={<BackLink href={ADMIN_ROUTES.picking.list} />}
      />
      <PickingWorkArea
        task={task}
        actor={actor}
        info={
          <>
            <TaskInfo task={task} actor={actor} orderNumber={orderNumber} />
            <OrderLinesSection lines={task.lines} />
          </>
        }
      />
    </>
  );
}

/** Chi tiết lấy hàng của một task: xác nhận từng dòng, bắt đầu / hoàn tất lấy hàng, gán lại. */
export function PickingDetail({ id }: { id: string }) {
  return (
    <FulfillmentPermissionGate
      scope="picking"
      permissions={[FULFILLMENT_PICK_PERMISSIONS.viewPage]}
    >
      <PickingDetailBody id={id} />
    </FulfillmentPermissionGate>
  );
}
