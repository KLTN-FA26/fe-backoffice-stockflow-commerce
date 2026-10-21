"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, Trash2 } from "lucide-react";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { reprintLabelHref } from "@/features/shipping/errors";
import { isShipmentComplete } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { LoadProgress, MONO } from "../primitives";
import { ShipmentParcels } from "./ShipmentParcels";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { LoadShipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;

interface ShipmentCardProps {
  shipment: LoadShipment;
  currency: string | null | undefined;
  /** Lô này chặn việc bàn giao (BE nêu tên lô) → viền đỏ + lý do + lối xử lý. */
  refusal?: HandoverRefusal | null;
  canRemove: boolean;
  canUnscan: boolean;
  unscanning: boolean;
  onRemove: (shipment: LoadShipment) => void;
  onUnscan: (shipment: LoadShipment, packageId: string) => void;
  onDismissRefusal: () => void;
}

/**
 * Một lô trên biên bản: tiến độ kiện lên xe, COD, các kiện (gỡ khỏi xe được trước bàn giao) và — khi
 * BE từ chối bàn giao vì lô này (chưa thanh toán, đơn tạm giữ, nhãn lệch COD) — lý do ngay tại lô.
 */
export function ShipmentCard({
  shipment,
  currency,
  refusal,
  canRemove,
  canUnscan,
  unscanning,
  onRemove,
  onUnscan,
  onDismissRefusal,
}: ShipmentCardProps) {
  const complete = isShipmentComplete(shipment);
  const money = (amount: number | null | undefined) =>
    amount != null && (shipment.currency ?? currency)
      ? formatMoney(amount, (shipment.currency ?? currency) as string)
      : null;
  const labelCod = money(shipment.labelCodAmount);
  const fixedCod = money(shipment.codAmount);
  return (
    <section
      aria-label={`${UI_LABELS.shipping.shipments.title} ${shipment.code}`}
      className={`bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] ${
        refusal ? "border-danger" : "border-border-default"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
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
          {complete && (
            <span className="text-positive inline-flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="size-3.5" aria-hidden /> {L.shipmentComplete}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LoadProgress
            loaded={shipment.loadedCount}
            expected={shipment.packageCount}
            label={`${L.shipmentLoaded} ${shipment.code}`}
          />
          {canRemove && (
            <Button type="button" variant="outline" size="xs" onClick={() => onRemove(shipment)}>
              <Trash2 className="size-3" /> {L.removeShipment}
            </Button>
          )}
        </div>
      </div>
      {(labelCod || fixedCod) && (
        <p className="text-ink-secondary mb-2 text-xs">
          {labelCod && `${L.labelCod}: ${labelCod}`}
          {labelCod && fixedCod && " · "}
          {fixedCod && `${L.fixedCod}: ${fixedCod}`}
        </p>
      )}
      {refusal && (
        <Alert tone="danger" title={L.refusalTitle} className="mb-3">
          <p>{refusal.message}</p>
          <p className="mt-1">{L.refusalHint}</p>
          {refusal.reprintLabel && (
            <p className="mt-1">
              {L.reprintHint}{" "}
              <Link
                href={reprintLabelHref(shipment.taskId)}
                className="inline-flex items-center gap-1 underline"
              >
                {L.reprintLabel} <ExternalLink className="size-3" aria-hidden />
              </Link>
            </p>
          )}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onDismissRefusal}
          >
            {L.dismissRefusal}
          </Button>
        </Alert>
      )}
      <ShipmentParcels
        shipment={shipment}
        canUnscan={canUnscan}
        unscanning={unscanning}
        onUnscan={onUnscan}
      />
    </section>
  );
}
