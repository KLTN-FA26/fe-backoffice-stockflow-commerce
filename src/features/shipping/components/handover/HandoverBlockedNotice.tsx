"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { handoverBlockReasons, handoverReasonCodes } from "@/features/shipping/handover-blocks";
import { Alert } from "@/components/shared/Alert";

import { HandoverReasonLink } from "./HandoverReasonLink";

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
            <BlockReasons reasons={handoverBlockReasons(order)} />
            {handoverReasonCodes(order).map((reasonCode) => (
              <HandoverReasonLink
                key={reasonCode}
                orderId={order.orderId}
                reasonCode={reasonCode}
              />
            ))}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

/** Một lý do: nối ngay sau mã đơn; nhiều lý do: mỗi lý do một dòng (ký một lần thấy đủ, không phải ký lại từng bước). */
export function BlockReasons({ reasons }: { reasons: readonly string[] }) {
  if (reasons.length === 1) return <>: {reasons[0]}</>;
  return (
    <>
      :
      <ul className="list-disc pl-5">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </>
  );
}
