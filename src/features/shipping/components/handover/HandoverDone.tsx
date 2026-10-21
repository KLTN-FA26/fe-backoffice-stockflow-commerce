"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover.done;

/** Kết quả bàn giao: chuyến DISPATCHED và các lô đã đi cùng hãng (COD đơn chốt từng lô). */
export function HandoverDone({ load, onClose }: { load: Load; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <FormDialogBody
        title={`${H.title} · ${load.code}`}
        description={H.description}
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
            <li key={shipment.shipmentId} className="flex justify-between gap-3">
              <Link
                href={ADMIN_ROUTES.shipments.detail(shipment.shipmentId)}
                className={`text-accent hover:underline ${MONO}`}
              >
                {shipment.code}
              </Link>
              <span className="text-ink-secondary tabular-nums">
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
