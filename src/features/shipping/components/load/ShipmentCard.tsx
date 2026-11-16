"use client";

import { CheckCircle2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { isShipmentComplete } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { LoadProgress } from "../primitives";
import { ShipmentIdentity } from "./ShipmentIdentity";
import { ShipmentParcels } from "./ShipmentParcels";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { LoadShipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;

interface ShipmentCardProps {
  shipment: LoadShipment;
  /** Lô này chặn việc bàn giao (BE nêu tên lô) → viền đỏ + lý do. */
  refusal?: HandoverRefusal | null;
  canUnscan: boolean;
  unscanning: boolean;
  onUnscan: (shipment: LoadShipment, packageId: string) => void;
  onDismissRefusal: () => void;
}

/**
 * Một lô trên biên bản: tiến độ kiện lên xe, các kiện (gỡ khỏi xe được trước bàn giao) và — khi BE từ chối bàn giao vì lô
 * này (đợt thanh toán chưa thu, đơn tạm giữ…) — lý do ngay tại lô.
 */
export function ShipmentCard({
  shipment,
  refusal,
  canUnscan,
  unscanning,
  onUnscan,
  onDismissRefusal,
}: ShipmentCardProps) {
  const complete = isShipmentComplete(shipment);
  return (
    <section
      aria-label={`${UI_LABELS.shipping.shipments.title} ${shipment.code}`}
      className={`bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] ${
        refusal ? "border-danger" : "border-border-default"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <ShipmentIdentity shipment={shipment} />
          {complete && (
            <span className="text-positive inline-flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="size-3.5" aria-hidden /> {L.shipmentComplete}
            </span>
          )}
        </div>
        <LoadProgress
          loaded={shipment.loadedCount}
          expected={shipment.packageCount}
          label={`${L.shipmentLoaded} ${shipment.code}`}
        />
      </div>
      {refusal && (
        <Alert tone="danger" title={L.refusalTitle} className="mb-3">
          <p>{refusal.message}</p>
          <p className="mt-1">{L.refusalHint}</p>
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
