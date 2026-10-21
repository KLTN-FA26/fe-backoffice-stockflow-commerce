"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { findShipmentByCode } from "@/features/shipping/selectors";
import { useRemoveLoadShipment, useUnscanPackage } from "@/features/shipping/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import { ShipmentCard } from "./ShipmentCard";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { Load, LoadShipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;

interface LoadShipmentsProps {
  load: Load;
  canEditShipments: boolean;
  canUnscan: boolean;
  refusal: HandoverRefusal | null;
  onDismissRefusal: () => void;
  onAdd: () => void;
}

/**
 * Các lô trên biên bản của chuyến (docs 09 §4.1 bước 3): thêm / bỏ lô, gỡ kiện khỏi xe, và lô nào đang
 * chặn bàn giao. Bỏ lô cũng gỡ các kiện đã quét của nó khỏi xe — hỏi xác nhận.
 */
export function LoadShipments({
  load,
  canEditShipments,
  canUnscan,
  refusal,
  onDismissRefusal,
  onAdd,
}: LoadShipmentsProps) {
  const remove = useRemoveLoadShipment();
  const unscan = useUnscanPackage();
  const [removing, setRemoving] = useState<LoadShipment | null>(null);
  // Lô bị chỉ mặt đã rời chuyến (bỏ ra / tải lại) → không còn gì để đánh dấu
  const activeRefusal =
    refusal?.shipmentCode && findShipmentByCode(load, refusal.shipmentCode) ? refusal : null;

  return (
    <section aria-label={L.shipmentsTitle} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
          {L.shipmentsTitle} ({load.shipments.length})
        </h2>
        {canEditShipments && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="size-3.5" /> {L.addShipments}
          </Button>
        )}
      </div>
      {load.shipments.length === 0 && <EmptyState title={L.noShipments} description="" />}
      {load.shipments.map((shipment) => (
        <ShipmentCard
          key={shipment.shipmentId}
          shipment={shipment}
          currency={load.currency}
          refusal={activeRefusal?.shipmentCode === shipment.code ? activeRefusal : null}
          canRemove={canEditShipments}
          canUnscan={canUnscan}
          unscanning={unscan.isPending}
          onRemove={setRemoving}
          onUnscan={(_, packageId) => unscan.mutate({ loadId: load.loadId, packageId })}
          onDismissRefusal={onDismissRefusal}
        />
      ))}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setRemoving(null)}
          title={`${L.removeShipment} ${removing.code}`}
          description={`${removing.code}: các kiện đã quét của lô này được gỡ khỏi xe và lô trở về danh sách chờ xuất.`}
          confirmLabel={L.removeShipment}
          variant="danger"
          loading={remove.isPending}
          closeOnConfirm={false}
          onConfirm={() =>
            remove.mutate(
              { loadId: load.loadId, shipmentId: removing.shipmentId },
              { onSuccess: () => setRemoving(null), onError: () => setRemoving(null) },
            )
          }
        />
      )}
    </section>
  );
}
