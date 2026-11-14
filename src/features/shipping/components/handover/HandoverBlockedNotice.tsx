"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { handoverBlockReason } from "@/features/shipping/handover-blocks";
import { Alert } from "@/components/shared/Alert";

import type { HandoverWarning } from "@/features/shipping/types";

const B = UI_LABELS.shipping.waybill.blocked;

/**
 * BE từ chối bàn giao CẢ XE (409 LOAD_HANDOVER_BLOCKED, docs 09 BR-18: tất cả hoặc không): liệt kê từng đơn chưa được
 * phép đi (`details.orders[]`) kèm lý do — chưa thu đợt trước khi giao (số tiền còn thiếu, đợt giao), chưa tới ngày mở cửa
 * sổ giao (ngày), đơn đang treo. Muốn xe đi mà không có đơn đó thì dỡ kiện của nó bằng huỷ có kiểm soát xe.
 */
export function HandoverBlockedNotice({ orders }: { orders: readonly HandoverWarning[] }) {
  return (
    <Alert tone="danger" title={B.title}>
      <p>{B.description}</p>
      <ul className="mt-1 space-y-1">
        {orders.map((order) => (
          <li key={order.orderId}>
            <Link
              href={ADMIN_ROUTES.orders.detail(order.orderId)}
              className="font-medium underline"
            >
              {order.orderNumber}
            </Link>
            : {handoverBlockReason(order)}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
