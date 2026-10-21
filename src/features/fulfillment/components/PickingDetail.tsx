"use client";

import { ADMIN_ROUTES, FULFILLMENT_PICK_PERMISSIONS, UI_LABELS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useFulfillmentOrder, useFulfillmentTask } from "@/features/fulfillment/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BackLink } from "@/components/shared/BackLink";

import { OrderLinesSection } from "./detail/OrderLinesSection";
import { TaskActionCard } from "./detail/TaskActionCard";
import { TaskInfo } from "./detail/TaskInfo";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { orderLabel, taskCode } from "./primitives";
import { useFulfillmentActor, useTaskReferences } from "./useFulfillmentActor";

const { fulfillment } = UI_LABELS;

function PickingDetailBody({ id }: { id: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const refs = useTaskReferences(actor);
  const query = useFulfillmentTask(id, { enabled: canRead });
  const order = useFulfillmentOrder(query.data?.orderId, refs.canReadOrders);
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
  const orderNumber = order.data?.orderNumber ?? refs.orderNumbers?.[task.orderId];

  return (
    <>
      <PageHeader
        title={`Task ${taskCode(task.taskId)}`}
        subtitle={`${fulfillment.pickingTitle} · Đơn ${orderNumber ?? orderLabel(task.orderId, undefined)}`}
        actions={<BackLink href={ADMIN_ROUTES.picking.list} />}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <TaskInfo
            task={task}
            actor={actor}
            orderNumber={orderNumber}
            userNames={refs.userNames}
          />
          <OrderLinesSection scope="picking" canReadOrders={refs.canReadOrders} order={order} />
        </div>
        <div className="space-y-5">
          <TaskActionCard task={task} scope="picking" actor={actor} />
        </div>
      </div>
    </>
  );
}

/** Chi tiết lấy hàng của một task: bắt đầu / hoàn tất lấy hàng, gán lại. */
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
