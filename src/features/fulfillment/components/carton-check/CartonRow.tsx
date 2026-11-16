"use client";

import { Printer, RotateCcw, Tag, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, formatMeasure } from "../primitives";

import type { CartonActions } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck.cartons;
const A = UI_LABELS.cartonCheck.action;
const TD = "px-3 py-2 text-[0.8125rem] align-top";

function sizeText(carton: Carton): string {
  if (carton.lengthCm == null || carton.widthCm == null || carton.heightCm == null) return "—";
  return L.sizeCell(
    formatMeasure(carton.lengthCm, 2),
    formatMeasure(carton.widthCm, 2),
    formatMeasure(carton.heightCm, 2),
  );
}

function weightText(carton: Carton): string {
  if (carton.weightKg == null) return "—";
  return L.weightCell(formatMeasure(carton.weightKg), formatMeasure(carton.dimWeightKg ?? 0));
}

const REMOVAL_REASON = {
  DAMAGED: L.removedDamaged,
  ORDER_CANCELLED: L.removedOrderCancelled,
} as const;

export interface CartonRowHandlers {
  onLabel: (carton: Carton) => void;
  onPrint: (carton: Carton) => void;
  onReprint: (carton: Carton) => void;
  onRemove: (carton: Carton) => void;
}

/** Một thùng: LPN, SKU, số cái, trạng thái, nhãn (phiên bản), kích thước / khối lượng theo quy cách thùng và thao tác khả dụng. */
export function CartonRow({
  carton,
  actions,
  shipmentCode,
  labeling,
  handlers,
}: {
  carton: Carton;
  actions: CartonActions;
  shipmentCode: string | undefined;
  labeling: boolean;
  handlers: CartonRowHandlers;
}) {
  return (
    <tr className="border-border-default border-b last:border-b-0">
      <td className={`${TD} text-ink-secondary ${MONO}`}>{carton.packageNo}</td>
      <td className={`${TD} text-ink-primary ${MONO}`}>{carton.lpn}</td>
      <td className={`${TD} ${MONO}`}>{carton.sku}</td>
      <td className={`${TD} text-ink-secondary ${MONO}`}>{carton.lotNumber ?? "—"}</td>
      <td className={`${TD} text-right ${MONO}`}>{carton.quantity}</td>
      <td className={TD}>
        <StatusDot domain="pack" status={carton.status} />
        {carton.removalReason && (
          <span className="text-ink-tertiary mt-0.5 block text-xs">
            {REMOVAL_REASON[carton.removalReason]}
            {carton.removalNote && (
              <span title={L.removalNote(carton.removalNote)}> · {carton.removalNote}</span>
            )}
          </span>
        )}
      </td>
      <td className={`${TD} ${MONO}`}>
        {carton.labelVersion > 0 ? (
          <span title={carton.labeledAt ? formatDateTime(carton.labeledAt) : undefined}>
            {L.labelVersion(carton.labelVersion)}
          </span>
        ) : (
          L.noLabel
        )}
      </td>
      <td className={`${TD} text-ink-secondary`}>
        {sizeText(carton)}
        {carton.labelVersion > 0 && !carton.rotatable && (
          <span className="text-warning ml-1 text-xs">{L.notRotatable}</span>
        )}
      </td>
      <td className={`${TD} text-ink-secondary tabular-nums`}>{weightText(carton)}</td>
      <td className={`${TD} text-ink-secondary ${MONO}`}>{shipmentCode ?? "—"}</td>
      <td className={TD}>
        <div className="flex flex-wrap gap-1.5">
          {actions.label && (
            <Button
              type="button"
              size="xs"
              disabled={labeling}
              onClick={() => handlers.onLabel(carton)}
            >
              <Tag className="size-3" /> {A.label}
            </Button>
          )}
          {actions.print && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => handlers.onPrint(carton)}
            >
              <Printer className="size-3" /> {A.print}
            </Button>
          )}
          {actions.reprint && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => handlers.onReprint(carton)}
            >
              <RotateCcw className="size-3" /> {A.reprint}
            </Button>
          )}
          {actions.remove && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => handlers.onRemove(carton)}
            >
              <Trash2 className="size-3" /> {A.remove}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
