"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";

import type { Load, LoadShipment } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover.done;
const FTL = UI_LABELS.shipping.ftl.handover;

/**
 * Lô chỉ HANDED_OVER ở xe cuối cùng chở lô đó (docs 09 §4.2 bước 8, BR-03) → sau xe không phải xe cuối, lô còn
 * READY_TO_DISPATCH và phải nói "Chờ xe cuối" thay vì để cả danh sách trông như đã bàn giao.
 */
function ShipmentHandoverStatus({ status }: { status: LoadShipment["status"] }) {
  const label = FTL.shipmentStatus[status as keyof typeof FTL.shipmentStatus];
  if (!label) return <StatusDot domain="shipment" status={PACK_SHIPMENT_STATUS_DISPLAY[status]} />;
  return (
    <span
      className={
        status === "HANDED_OVER" ? "text-positive font-medium" : "text-warning font-medium"
      }
    >
      {label}
    </span>
  );
}

/**
 * Kết quả bàn giao: một câu "Đã bàn giao N kiện cho <hãng>" (không lặp "Đã bàn giao" ba lần — S18-4), các lô trên xe, nút
 * "Xem biên bản" và Đóng. Chuyến DISPATCHED và các lô trên xe (lô nào đã bàn giao hẳn, lô nào chờ xe cuối). */
export function HandoverDone({ load, onClose }: { load: Load; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <FormDialogBody
        title={`${FTL.doneTitle} · ${load.code}`}
        description={FTL.doneSummary(
          load.loadedPackageCount,
          load.carrierName ?? FTL.doneCarrierFallback,
        )}
        submitLabel={H.close}
        canSubmit
        isPending={false}
        error={null}
        hideCancel
        onSubmit={onClose}
        onCancel={onClose}
      >
        <p className="text-ink-secondary text-[0.8125rem]">{FTL.doneLots}</p>
        <ul className="space-y-1 text-[0.8125rem]">
          {load.shipments.map((shipment) => (
            <li key={shipment.shipmentId} className="flex items-center gap-3">
              <Link
                href={ADMIN_ROUTES.shipments.detail(shipment.shipmentId)}
                className={`text-accent-text hover:underline ${MONO}`}
              >
                {shipment.code}
              </Link>
              <ShipmentHandoverStatus status={shipment.status} />
              <span className="text-ink-secondary ml-auto tabular-nums">
                {shipment.packageCount} kiện
              </span>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.loads.manifest(load.loadId)}>{H.manifest}</Link>
        </Button>
      </FormDialogBody>
    </FormDialog>
  );
}
