"use client";

import Link from "next/link";

import { ADMIN_ROUTES, ORDER_PERMISSIONS, PICK_DESTINATION, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { InfoItem, Section, assigneeLabel, orderLabel } from "../primitives";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const FIELD = UI_LABELS.fulfillment.field;
const DESTINATION = UI_LABELS.fulfillment.destination;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/**
 * Thông tin nhiệm vụ — chỉ field BE trả; số đơn tra thêm nếu đủ quyền. Số nhiệm vụ là `taskNumber` BE cấp
 * ("PK-yyyyMMdd-nnnn"); bản BE cũ chưa có thì không hiện dòng này — không bịa mã, không để lộ UUID.
 */
export function TaskInfo({
  task,
  actor,
  orderNumber,
}: {
  task: FulfillmentTask;
  actor: FulfillmentActor;
  /** Số đơn đã tra được; thiếu → id rút gọn. */
  orderNumber: string | undefined;
}) {
  const orderText = orderLabel(task.orderId, orderNumber);
  return (
    <Section title={UI_LABELS.fulfillment.taskInfoTitle}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {task.taskNumber && <InfoItem label={FIELD.task} mono value={task.taskNumber} />}
        <InfoItem
          label={FIELD.order}
          mono
          value={
            actor.can(ORDER_PERMISSIONS.viewPage) ? (
              <Link
                href={ADMIN_ROUTES.orders.detail(task.orderId)}
                className="text-accent-text hover:underline"
                title={task.orderId}
              >
                {orderText}
              </Link>
            ) : (
              <span title={task.orderId}>{orderText}</span>
            )
          }
        />
        <InfoItem
          label={FIELD.assignee}
          value={
            <span title={task.assignedUserId ?? undefined}>
              {assigneeLabel(task.assignedUserId, task.assignedUserName, actor.userId)}
            </span>
          }
        />
        <InfoItem
          label={FIELD.destination}
          value={task.destination ? DESTINATION[task.destination] : "—"}
        />
        {task.destination === PICK_DESTINATION.STAGING && (
          <>
            <InfoItem label={FIELD.stagingLocation} value={task.stagingLocationCode ?? "—"} mono />
            <InfoItem label={FIELD.stagedAt} value={dt(task.stagedAt)} />
            <InfoItem label={FIELD.movedToDispatchAt} value={dt(task.movedToDispatchAt)} />
          </>
        )}
        <InfoItem label={FIELD.assignedAt} value={dt(task.assignedAt)} />
        <InfoItem label="Bắt đầu lấy hàng" value={dt(task.startedAt)} />
        <InfoItem label="Lấy hàng xong" value={dt(task.pickedAt)} />
        <InfoItem label={FIELD.packedAt} value={dt(task.packedAt)} />
      </div>
    </Section>
  );
}
