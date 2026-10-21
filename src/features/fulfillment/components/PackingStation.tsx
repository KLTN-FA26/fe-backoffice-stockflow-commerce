"use client";

import {
  ADMIN_ROUTES,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { canDownloadArtifact } from "@/features/fulfillment/lifecycle";
import { useFulfillmentOrder, useFulfillmentTask } from "@/features/fulfillment/queries";
import { isOnDesignHold } from "@/features/fulfillment/selectors";
import { Alert } from "@/components/shared/Alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BackLink } from "@/components/shared/BackLink";

import { TaskActionCard } from "./detail/TaskActionCard";
import { TaskInfo } from "./detail/TaskInfo";
import { FulfillmentLoadError } from "./FulfillmentLoadError";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { DesignLinesSection } from "./packing/DesignLinesSection";
import { EvidenceTable } from "./packing/EvidenceTable";
import { Section, orderLabel, taskCode } from "./primitives";
import { useFulfillmentActor, useTaskReferences } from "./useFulfillmentActor";

const { fulfillment } = UI_LABELS;

function PackingStationBody({ id }: { id: string }) {
  const actor = useFulfillmentActor();
  const canRead = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const refs = useTaskReferences(actor);
  const query = useFulfillmentTask(id, { enabled: canRead });
  const order = useFulfillmentOrder(query.data?.orderId, refs.canReadOrders);
  useBreadcrumbLabel(id, query.data ? taskCode(query.data.taskId) : undefined);

  if (!canRead) return <FulfillmentLoadError scope="packing" error={null} kind="no-read" />;
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) {
    return (
      <FulfillmentLoadError
        scope="packing"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const task = query.data;
  const orderNumber = order.data?.orderNumber ?? refs.orderNumbers?.[task.orderId];
  const skuByLine = Object.fromEntries(
    (order.data?.lines ?? []).map((line) => [line.lineId, line.sku]),
  );

  return (
    <>
      <PageHeader
        title={`Trạm đóng gói — task ${taskCode(task.taskId)}`}
        subtitle={`${fulfillment.packingTitle} · Đơn ${orderNumber ?? orderLabel(task.orderId, undefined)}`}
        actions={<BackLink href={ADMIN_ROUTES.packing.list} />}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {isOnDesignHold(task) && (
            <Alert tone="danger" title={fulfillment.holdTitle}>
              {fulfillment.holdDescription}
            </Alert>
          )}
          <DesignLinesSection
            task={task}
            canReadOrders={refs.canReadOrders}
            order={order}
            canDownload={canDownloadArtifact(task, actor)}
          />
          <Section
            title="Lịch sử đối chiếu thiết kế"
            description="Mỗi lần xác nhận đóng gói hoặc kiểm tra lại, hệ thống ghi một bản cho mỗi dòng tuỳ chỉnh."
          >
            <EvidenceTable evidence={task.integrityEvidence} skuByLine={skuByLine} />
          </Section>
          <TaskInfo
            task={task}
            actor={actor}
            orderNumber={orderNumber}
            userNames={refs.userNames}
          />
        </div>
        <div className="space-y-5">
          <TaskActionCard task={task} scope="packing" actor={actor} />
        </div>
      </div>
    </>
  );
}

/** Trạm đóng gói của một task: đối chiếu thiết kế đã khoá, xác nhận đóng gói, xử lý kiện bị giữ. */
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
