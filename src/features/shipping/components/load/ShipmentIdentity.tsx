"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../primitives";

import type { LoadShipment } from "@/features/shipping/types";

const T = UI_LABELS.shipping.ftl.transfer;

/**
 * Định danh một dòng của biên bản: lô giao (liên kết lô, liên kết đơn, trạng thái lô) hoặc — ở xe của kế hoạch nguồn
 * TRANSFER (BE PR #164) — MỘT lệnh chuyển kho (số lệnh liên kết sang lệnh, nhãn "Lệnh chuyển kho"; không có lô giao / đơn,
 * và `status` là của lệnh nên không hiện như trạng thái lô).
 */
export function ShipmentIdentity({ shipment }: { shipment: LoadShipment }) {
  const transferId = shipment.transferOrderId;
  if (transferId) {
    return (
      <>
        <Link
          href={ADMIN_ROUTES.transfers.detail(transferId)}
          className={`text-accent text-[0.875rem] font-semibold hover:underline ${MONO}`}
        >
          {shipment.code}
        </Link>
        <span
          title={T.badgeTitle}
          className="border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem]"
        >
          {T.badge}
        </span>
      </>
    );
  }
  return (
    <>
      {shipment.shipmentId && (
        <Link
          href={ADMIN_ROUTES.shipments.detail(shipment.shipmentId)}
          className={`text-accent text-[0.875rem] font-semibold hover:underline ${MONO}`}
        >
          {shipment.code}
        </Link>
      )}
      {shipment.orderId && (
        <Link
          href={ADMIN_ROUTES.orders.detail(shipment.orderId)}
          className={`text-ink-secondary text-xs hover:underline ${MONO}`}
        >
          {shipment.orderNumber ?? shipment.orderId}
        </Link>
      )}
      <StatusDot domain="shipment" status={PACK_SHIPMENT_STATUS_DISPLAY[shipment.status]} />
    </>
  );
}
