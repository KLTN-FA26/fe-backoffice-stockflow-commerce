"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../primitives";

import type { LoadShipment } from "@/features/shipping/types";

/** Định danh một lô giao trên biên bản: liên kết lô, liên kết đơn, trạng thái lô. */
export function ShipmentIdentity({ shipment }: { shipment: LoadShipment }) {
  return (
    <>
      <Link
        href={ADMIN_ROUTES.shipments.detail(shipment.shipmentId)}
        className={`text-accent text-[0.875rem] font-semibold hover:underline ${MONO}`}
      >
        {shipment.code}
      </Link>
      <Link
        href={ADMIN_ROUTES.orders.detail(shipment.orderId)}
        className={`text-ink-secondary text-xs hover:underline ${MONO}`}
      >
        {shipment.orderNumber ?? shipment.orderId}
      </Link>
      <StatusDot domain="shipment" status={PACK_SHIPMENT_STATUS_DISPLAY[shipment.status]} />
    </>
  );
}
