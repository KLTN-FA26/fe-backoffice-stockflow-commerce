"use client";

import { FULFILLMENT_PICK_PERMISSIONS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useFulfillmentTask } from "@/features/fulfillment/queries";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { OrderLinesSection } from "./detail/OrderLinesSection";
import { TaskInfo } from "./detail/TaskInfo";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { PickingWorkArea } from "./picking/PickingWorkArea";
import { taskCode } from "./primitives";
import { useFulfillmentActor } from "./useFulfillmentActor";

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
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có mã task và link về danh sách; mã task + đơn nằm ở "Thông tin task".
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`Task ${taskCode(task.taskId)}`}</h1>
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
    </div>
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
