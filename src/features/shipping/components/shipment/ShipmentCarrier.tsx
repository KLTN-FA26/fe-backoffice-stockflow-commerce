"use client";

import { UI_LABELS } from "@/constants";
import { useAssignCarrier } from "@/features/shipping/shipment-mutations";
import { Label } from "@/components/ui/label";

import { CarrierSelect } from "../CarrierSelect";

import type { ShipmentRow } from "@/features/shipping/types";

const L = UI_LABELS.shipping.shipment;

/** Hãng của lô: chọn / bỏ khi còn chờ xuất và chưa lên chuyến; ngược lại chỉ hiện tên (BE 409 nếu đã lên chuyến). */
export function ShipmentCarrier({
  shipment,
  canAssign,
}: {
  shipment: ShipmentRow;
  canAssign: boolean;
}) {
  const assign = useAssignCarrier();
  return (
    <div>
      <Label htmlFor="shipment-carrier-edit" className="text-ink-tertiary mb-1 block text-xs">
        {L.carrierCard}
      </Label>
      {canAssign ? (
        <CarrierSelect
          id="shipment-carrier-edit"
          value={shipment.carrierId ?? null}
          currentName={shipment.carrierName}
          allowNone
          disabled={assign.isPending}
          onChange={(carrierId) => assign.mutate({ shipmentId: shipment.shipmentId, carrierId })}
        />
      ) : (
        <>
          <p className="text-ink-primary text-[0.8125rem] font-medium">
            {shipment.carrierName ?? UI_LABELS.shipping.field.carrierNone}
          </p>
          {shipment.status === "READY_TO_DISPATCH" && shipment.loadId && (
            <p className="text-ink-tertiary mt-0.5 text-xs">{L.carrierLocked}</p>
          )}
        </>
      )}
    </div>
  );
}
