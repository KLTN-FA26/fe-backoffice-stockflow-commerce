"use client";

import { UI_LABELS } from "@/constants";
import { forgetScanId } from "@/features/shipping/scan-ids";
import { findShipmentByCode } from "@/features/shipping/selectors";
import { useUnscanPackage } from "@/features/shipping/mutations";
import { EmptyState } from "@/components/shared/EmptyState";

import { ShipmentCard } from "./ShipmentCard";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;

interface LoadShipmentsProps {
  load: Load;
  canUnscan: boolean;
  refusal: HandoverRefusal | null;
  onDismissRefusal: () => void;
}

/**
 * Các lô trên biên bản của xe (docs 09 §4.2 bước 8): kiện của từng lô, gỡ kiện khỏi xe trước bàn giao, và lô nào đang chặn
 * bàn giao. Danh sách lô do kế hoạch xếp xe quyết định nên không thêm / bớt lô tay.
 */
export function LoadShipments({ load, canUnscan, refusal, onDismissRefusal }: LoadShipmentsProps) {
  const unscan = useUnscanPackage();
  // Lô bị chỉ mặt đã rời chuyến (tải lại) → không còn gì để đánh dấu
  const activeRefusal =
    refusal?.shipmentCode && findShipmentByCode(load, refusal.shipmentCode) ? refusal : null;

  return (
    <section aria-label={L.shipmentsTitle} className="space-y-3">
      <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
        {L.shipmentsTitle} ({load.shipments.length})
      </h2>
      {load.shipments.length === 0 && <EmptyState title={L.noShipments} description="" />}
      {load.shipments.map((shipment) => (
        <ShipmentCard
          key={shipment.shipmentId}
          shipment={shipment}
          refusal={activeRefusal?.shipmentCode === shipment.code ? activeRefusal : null}
          canUnscan={canUnscan}
          unscanning={unscan.isPending}
          onUnscan={(owner, packageId) => {
            // Sau khi gỡ, quét lại phải là lần quét MỚI (không dùng lại scanId đang chờ của mã này)
            const label = owner.packages.find((p) => p.packageId === packageId)?.labelCode;
            if (label) forgetScanId(load.loadId, label);
            unscan.mutate({ loadId: load.loadId, packageId });
          }}
          onDismissRefusal={onDismissRefusal}
        />
      ))}
    </section>
  );
}
