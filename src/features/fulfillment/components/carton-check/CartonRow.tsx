"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, formatMeasure } from "../primitives";
import { CartonRowActions, PINNED } from "./CartonRowActions";

import type { CartonRemovalReason } from "@/constants";
import type { CartonRowHandlers } from "./CartonRowActions";
import type { CartonActions } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck.cartons;
const TD = "px-3 py-2 text-[0.8125rem] align-top";
/** Mã (LPN, SKU, lô) luôn một dòng — không bẻ giữa chừng, bảng cuộn ngang thay vì ép mã xuống 3 dòng. */
const CODE_TD = `${TD} whitespace-nowrap`;

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
  REMAINDER_CLOSED: L.removedRemainderClosed,
} as const satisfies Record<CartonRemovalReason, string>;

/** Một thùng: LPN, SKU, số cái, trạng thái, nhãn (phiên bản), kích thước / khối lượng theo quy cách thùng và thao tác khả dụng. */
export function CartonRow({
  carton,
  actions,
  shipmentCode,
  labeling,
  handlers,
  labelHeld,
  heldTitle,
  columns,
}: {
  carton: Carton;
  actions: CartonActions;
  shipmentCode: string | undefined;
  labeling: boolean;
  handlers: CartonRowHandlers;
  /** Đơn treo: nút dán nhãn của thùng bị tắt (WF4-K2), `heldTitle` nói lý do. */
  labelHeld?: boolean;
  heldTitle?: string;
  /** Cột tuỳ chọn đang hiện (ẩn khi không thùng nào có dữ liệu) — xem `CartonsTable`. */
  columns: { size: boolean; weight: boolean; shipment: boolean };
}) {
  return (
    <tr className="border-border-default border-b last:border-b-0">
      <td className={`${CODE_TD} text-ink-secondary ${MONO}`}>{carton.packageNo}</td>
      <td className={`${CODE_TD} text-ink-primary ${MONO}`}>{carton.lpn}</td>
      <td className={CODE_TD}>
        <span className={MONO}>{carton.sku}</span>
        {carton.lotNumber && (
          <span className={`text-ink-tertiary block text-xs ${MONO}`}>
            {L.lotLine(carton.lotNumber)}
          </span>
        )}
      </td>
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
      {columns.size && (
        <td className={`${TD} text-ink-secondary whitespace-nowrap`}>
          {sizeText(carton)}
          {carton.labelVersion > 0 && !carton.rotatable && (
            <span className="text-warning ml-1 text-xs">{L.notRotatable}</span>
          )}
        </td>
      )}
      {columns.weight && (
        <td className={`${TD} text-ink-secondary whitespace-nowrap tabular-nums`}>
          {weightText(carton)}
        </td>
      )}
      {columns.shipment && (
        <td className={`${CODE_TD} text-ink-secondary ${MONO}`}>{shipmentCode ?? "—"}</td>
      )}
      <td className={`${TD} ${PINNED} bg-bg-surface`}>
        <CartonRowActions
          carton={carton}
          actions={actions}
          labeling={labeling}
          handlers={handlers}
          labelHeld={labelHeld}
          heldTitle={heldTitle}
        />
      </td>
    </tr>
  );
}
