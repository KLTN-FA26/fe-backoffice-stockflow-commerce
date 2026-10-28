"use client";

import { useState } from "react";
import { cn } from "cn";
import { Truck } from "lucide-react";

import { FULFILLMENT_DISPATCH_PERMISSIONS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { canAssignCarrier } from "@/features/shipping/shipment-lifecycle";
import { summarizeSelection } from "@/features/shipping/selectors";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { OpenLoadDialog } from "./OpenLoadDialog";
import { buildShipmentColumns } from "./shipment-list/columns";
import { ShipmentFilters } from "./shipment-list/ShipmentFilters";
import { ShipmentListBody } from "./shipment-list/ShipmentListBody";
import { useShipmentListState } from "./shipment-list/useShipmentListState";
import { ShippingPermissionGate } from "./ShippingPermissionGate";
import { useShippingActor } from "./useShippingActor";

const L = UI_LABELS.shipping;

function ShipmentListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const actor = useShippingActor();
  const s = useShipmentListState(canRead);
  const [opening, setOpening] = useState(false);
  const canOpen = actor.can(FULFILLMENT_DISPATCH_PERMISSIONS.create);
  const columns = buildShipmentColumns((row) => canAssignCarrier(row, actor), s.navigateToShipment);
  const selected = [...s.selected.values()];
  const selection = summarizeSelection(selected);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.shipments.title}</h1>
      {canRead && <ShipmentFilters s={s} />}
      {canOpen && s.status === "READY_TO_DISPATCH" && (
        <div className="border-border-default bg-bg-surface mb-3 flex flex-wrap items-center gap-3 rounded-(--section-radius) border px-3 py-2 text-[0.8125rem] shadow-(--card-shadow)">
          <span className="text-ink-secondary">
            {selected.length > 0
              ? `${selected.length} ${L.shipments.selected}`
              : L.shipments.selectHint}
          </span>
          {selection.mixedWarehouses && (
            <span role="alert" className="text-danger text-xs">
              {L.shipments.mixedWarehouses}
            </span>
          )}
          <Button
            size="sm"
            className={cn("ml-auto", TOOLBAR_ACTION_CLASS)}
            disabled={selected.length === 0 || selection.mixedWarehouses}
            onClick={() => setOpening(true)}
          >
            <Truck className="size-3.5" /> {L.shipments.openLoad}
          </Button>
        </div>
      )}
      <ShipmentListBody
        s={s}
        columns={columns}
        selectable={canOpen && s.status === "READY_TO_DISPATCH"}
      />
      <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
      {opening && <OpenLoadDialog shipments={selected} onClose={() => setOpening(false)} />}
    </div>
  );
}

/** Lô giao chờ xuất (docs 09 §4.1 bước 1–2): chọn hãng cho từng lô, chọn lô để mở chuyến. */
export function ShipmentList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <ShipmentListContent />
    </ShippingPermissionGate>
  );
}
