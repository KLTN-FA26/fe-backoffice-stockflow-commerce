"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { isFtlLoad } from "@/features/shipping/ftl-selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../primitives";

import type { Load, LoadShipment } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover.done;
const FTL = UI_LABELS.shipping.ftl.handover;

/**
 * Chuyến nguyên xe: lô chỉ HANDED_OVER ở xe cuối cùng chở lô đó (BE LP-3) → sau xe không phải xe cuối, lô còn
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

/** Kết quả bàn giao: chuyến DISPATCHED và các lô đã đi cùng hãng (COD đơn chốt từng lô). */
export function HandoverDone({ load, onClose }: { load: Load; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <FormDialogBody
        title={`${isFtlLoad(load) ? FTL.doneTitle : H.title} · ${load.code}`}
        description={isFtlLoad(load) ? FTL.doneDescription : H.description}
        submitLabel={H.close}
        canSubmit
        isPending={false}
        error={null}
        hideCancel
        onSubmit={onClose}
        onCancel={onClose}
      >
        <StatusDot domain="shipment" status={load.status} size="md" withIcon />
        <ul className="space-y-1 text-[0.8125rem]">
          {load.shipments.map((shipment) => (
            <li
              key={shipment.shipmentId ?? shipment.transferOrderId ?? shipment.code}
              className="flex items-center gap-3"
            >
              <Link
                href={
                  shipment.transferOrderId
                    ? ADMIN_ROUTES.transfers.detail(shipment.transferOrderId)
                    : ADMIN_ROUTES.shipments.detail(shipment.shipmentId ?? "")
                }
                className={`text-accent hover:underline ${MONO}`}
              >
                {shipment.code}
              </Link>
              {/* Trạng thái của dòng lệnh chuyển kho là của lệnh, không phải lô giao */}
              {isFtlLoad(load) && !shipment.transferOrderId && (
                <ShipmentHandoverStatus status={shipment.status} />
              )}
              <span className="text-ink-secondary ml-auto tabular-nums">
                {shipment.packageCount} kiện
                {shipment.codAmount != null && load.currency
                  ? ` · ${formatMoney(shipment.codAmount, load.currency)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={ADMIN_ROUTES.loads.manifest(load.loadId)}
          className="text-accent text-[0.8125rem] underline"
        >
          {H.manifest}
        </Link>
      </FormDialogBody>
    </FormDialog>
  );
}
