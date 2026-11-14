"use client";

import { SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";

import { buildShipmentColumns } from "./shipment-list/columns";
import { ShipmentFilters } from "./shipment-list/ShipmentFilters";
import { ShipmentListBody } from "./shipment-list/ShipmentListBody";
import { useShipmentListState } from "./shipment-list/useShipmentListState";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const L = UI_LABELS.shipping;

function ShipmentListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const s = useShipmentListState(canRead);
  const columns = buildShipmentColumns(s.navigateToShipment);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.shipments.title}</h1>
      {canRead && <ShipmentFilters s={s} />}
      <ShipmentListBody s={s} columns={columns} />
    </div>
  );
}

/** Lô giao (docs 09 §5): xem lô theo trạng thái, kho, hãng; mở lô để ghi nhận kết quả giao. Lô đi theo xe của kế hoạch xếp xe. */
export function ShipmentList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <ShipmentListContent />
    </ShippingPermissionGate>
  );
}
