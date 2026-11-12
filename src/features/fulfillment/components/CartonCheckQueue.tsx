"use client";

import { FULFILLMENT_PACKAGE_PERMISSIONS, UI_LABELS } from "@/constants";

import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { QueueBody } from "./carton-queue/QueueBody";
import { QueueToolbar } from "./carton-queue/QueueToolbar";
import { useCartonCheckQueueState } from "./carton-queue/useCartonCheckQueueState";
import { useFulfillmentActor } from "./useFulfillmentActor";

const L = UI_LABELS.cartonCheck;

function CartonCheckQueueContent() {
  const actor = useFulfillmentActor();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const s = useCartonCheckQueueState(canRead);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.queueTitle}</h1>
      {canRead && <QueueToolbar s={s} />}
      <QueueBody s={s} selfId={actor.userId} />
    </div>
  );
}

/** Hàng chờ kiểm thùng (BE `GET /fulfillment/packing-queue`) — cần `fulfillment-packages:VIEW_PAGE`. */
export function CartonCheckQueue() {
  return (
    <FulfillmentPermissionGate
      scope="packing"
      permissions={[FULFILLMENT_PACKAGE_PERMISSIONS.viewPage]}
      variant="list"
    >
      <CartonCheckQueueContent />
    </FulfillmentPermissionGate>
  );
}
