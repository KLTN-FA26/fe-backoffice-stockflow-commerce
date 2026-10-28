"use client";

import Link from "next/link";

import { ADMIN_ROUTES, ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { InfoItem, Section, assigneeLabel } from "../primitives";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const FIELD = UI_LABELS.fulfillment.field;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Thông tin task — chỉ field BE trả; số đơn tra thêm nếu đủ quyền. */
export function TaskInfo({
  task,
  actor,
  orderNumber,
}: {
  task: FulfillmentTask;
  actor: FulfillmentActor;
  /** Số đơn đã tra được; thiếu → hiện id. */
  orderNumber: string | undefined;
}) {
  const orderText = orderNumber ?? task.orderId;
  return (
    <Section title="Thông tin task">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoItem label={FIELD.task} value={<span title={task.taskId}>{task.taskId}</span>} mono />
        <InfoItem
          label={FIELD.order}
          mono
          value={
            actor.can(ORDER_PERMISSIONS.viewPage) ? (
              <Link
                href={ADMIN_ROUTES.orders.detail(task.orderId)}
                className="text-accent hover:underline"
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
        <InfoItem label={FIELD.assignedAt} value={dt(task.assignedAt)} />
        <InfoItem label="Bắt đầu lấy hàng" value={dt(task.startedAt)} />
        <InfoItem label="Lấy hàng xong" value={dt(task.pickedAt)} />
        <InfoItem label={FIELD.packedAt} value={dt(task.packedAt)} />
      </div>
    </Section>
  );
}
