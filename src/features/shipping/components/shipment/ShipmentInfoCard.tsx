"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  ORDER_DELIVERY_FAILURE_LABELS,
  PACK_SHIPMENT_STATUS_DISPLAY,
  UI_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoItem } from "../primitives";
import { ShipmentCarrier } from "./ShipmentCarrier";

import type { Shipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.shipment;
const F = UI_LABELS.shipping.field;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

function failureLabel(reason: string): string {
  return reason in ORDER_DELIVERY_FAILURE_LABELS
    ? ORDER_DELIVERY_FAILURE_LABELS[reason as keyof typeof ORDER_DELIVERY_FAILURE_LABELS]
    : reason;
}

/** Thông tin lô giao: đơn, kho, hãng (chọn được khi còn chờ xuất), chuyến, mốc thời gian, kết quả. */
export function ShipmentInfoCard({ data, canAssign }: { data: Shipment; canAssign: boolean }) {
  const { shipment } = data;
  const { data: warehouses } = useWarehouseDirectory();
  const warehouse = warehouses?.find((w) => w.warehouseId === shipment.warehouseId);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{L.info}</h2>
        <StatusDot
          domain="shipment"
          status={PACK_SHIPMENT_STATUS_DISPLAY[shipment.status]}
          size="md"
          withIcon
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoItem
          label={L.order}
          value={
            <Link
              href={ADMIN_ROUTES.orders.detail(shipment.orderId)}
              className="text-accent hover:underline"
            >
              {shipment.orderNumber ?? shipment.orderId}
            </Link>
          }
          mono
        />
        <InfoItem
          label={F.warehouse}
          value={warehouse ? `${warehouse.code} · ${warehouse.name}` : shipment.warehouseId}
        />
        <InfoItem label={UI_LABELS.shipping.load.modeLabel} value={L.mode[shipment.deliveryMode]} />
        <InfoItem
          label={F.cod}
          value={
            (shipment.codAmount ?? 0) > 0
              ? UI_LABELS.shipping.shipments.hasCod
              : UI_LABELS.shipping.shipments.noCod
          }
        />
        <InfoItem
          label={L.onLoad}
          value={
            shipment.loadId ? (
              <Link
                href={ADMIN_ROUTES.loads.detail(shipment.loadId)}
                className="text-accent hover:underline"
              >
                {shipment.loadCode ?? shipment.loadId}
              </Link>
            ) : (
              "—"
            )
          }
          mono
        />
        <InfoItem label={L.readyAt} value={dt(shipment.readyAt)} />
        <InfoItem label={L.handedOverAt} value={dt(shipment.handedOverAt)} />
        <InfoItem label={L.outcomeAt} value={dt(shipment.outcomeAt)} />
        {shipment.failureReason && (
          <InfoItem label={L.failureReason} value={failureLabel(shipment.failureReason)} />
        )}
      </div>
      <div className="mt-4 max-w-sm">
        <ShipmentCarrier shipment={shipment} canAssign={canAssign} />
      </div>
      {data.failureNote && (
        <p className="text-ink-secondary mt-3 text-[0.8125rem]">
          {L.failureNote}: {data.failureNote}
        </p>
      )}
      {data.partialNote && (
        <p className="text-ink-secondary mt-1 text-[0.8125rem]">
          {L.partialNote}: {data.partialNote}
        </p>
      )}
      {shipment.wholeOrderHandover && (
        <p className="text-ink-tertiary mt-1 text-xs">{L.wholeOrder}</p>
      )}
    </section>
  );
}
