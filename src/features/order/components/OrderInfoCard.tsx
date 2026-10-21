import { Fragment } from "react";

import { ORDER_DELIVERY_FAILURE_LABELS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format/date";

import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
}

const EMPTY = "—";

/** Mốc thời gian vòng đời đơn (BE PR #133) — chỉ hiện mốc đã có. */
const MILESTONES = [
  ["packedAt", "Đóng gói xong"],
  ["shippedAt", "Bàn giao vận chuyển"],
  ["deliveredAt", "Đã giao"],
  ["completedAt", "Hoàn tất"],
  ["closedAt", "Đã đóng sổ"],
] as const satisfies readonly (readonly [keyof Order, string])[];

export function OrderInfoCard({ order }: OrderInfoCardProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Thông tin</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
        <dt className="text-ink-secondary">Mã đơn</dt>
        <dd className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
          {order.orderNumber}
        </dd>
        <dt className="text-ink-secondary">Ngày đặt</dt>
        <dd className="text-ink-primary tabular-nums">{formatDate(order.placedAt)}</dd>
        <dt className="text-ink-secondary">Người nhận</dt>
        <dd className="text-ink-primary">
          {order.recipientName || EMPTY}
          {order.recipientPhone && ` · ${order.recipientPhone}`}
        </dd>
        <dt className="text-ink-secondary">Email</dt>
        <dd className="text-ink-primary">{order.contactEmail ?? EMPTY}</dd>
        <dt className="text-ink-secondary">Địa chỉ giao</dt>
        <dd className="text-ink-primary">{order.shippingAddressText ?? EMPTY}</dd>
        {MILESTONES.map(([key, label]) => {
          const value = order[key];
          return value ? (
            <Fragment key={key}>
              <dt className="text-ink-secondary">{label}</dt>
              <dd className="text-ink-primary tabular-nums">{formatDateTime(value)}</dd>
            </Fragment>
          ) : null;
        })}
        {order.deliveryFailureReason && (
          <>
            <dt className="text-ink-secondary">Giao thất bại</dt>
            <dd className="text-ink-primary">
              {order.deliveryFailureReason === "UNKNOWN"
                ? "Không rõ"
                : ORDER_DELIVERY_FAILURE_LABELS[order.deliveryFailureReason]}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
