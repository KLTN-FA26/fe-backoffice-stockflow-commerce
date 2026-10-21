"use client";

import { FULFILLMENT_PACKAGE_PERMISSIONS, UI_LABELS } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";

import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { QueueBody } from "./queue/QueueBody";
import { QueueToolbar } from "./queue/QueueToolbar";
import { usePackingQueueState } from "./queue/usePackingQueueState";
import { useFulfillmentActor } from "./useFulfillmentActor";

const L = UI_LABELS.packing;

function PackingQueueContent() {
  const actor = useFulfillmentActor();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const s = usePackingQueueState(canRead);

  return (
    <>
      <PageHeader title={L.queueTitle} subtitle={L.queueSubtitle} />
      {canRead && <QueueToolbar s={s} />}
      <QueueBody s={s} selfId={actor.userId} />
    </>
  );
}

/** Hàng chờ đóng gói (BE `GET /fulfillment/packing-queue`) — cần `fulfillment-packages:VIEW_PAGE`. */
export function PackingQueue() {
  return (
    <FulfillmentPermissionGate
      scope="packing"
      permissions={[FULFILLMENT_PACKAGE_PERMISSIONS.viewPage]}
      variant="list"
    >
      <PackingQueueContent />
    </FulfillmentPermissionGate>
  );
}
