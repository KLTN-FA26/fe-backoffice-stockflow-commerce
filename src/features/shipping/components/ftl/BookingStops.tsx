"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const A = UI_LABELS.shipping.waybill.apiBooking;

/**
 * Thứ tự điểm giao của hãng đặt xe qua API (docs 09 §4.2 bước 6, BR-29, E26): điểm 0 là kho xuất, mỗi lô giao trên xe là
 * một điểm giao, theo thứ tự Dispatch Staff xác nhận (kế hoạch xếp xe chưa sắp theo thứ tự giao). `order` là mã lô giao
 * (`shipmentId`) theo thứ tự hiện tại.
 */
export function BookingStops({
  load,
  order,
  disabled,
  onMove,
}: {
  load: Load;
  order: readonly string[];
  disabled: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  const byId = new Map(load.shipments.map((shipment) => [shipment.shipmentId, shipment]));
  return (
    <div>
      <p className="text-ink-secondary mb-1 text-xs font-medium">{A.stops}</p>
      <p className="text-ink-tertiary mb-2 text-xs">{A.stopsHint}</p>
      <ol className="border-border-default divide-border-default divide-y rounded-[var(--r-sm)] border">
        {order.map((shipmentId, index) => {
          const shipment = byId.get(shipmentId);
          if (!shipment) return null;
          return (
            <li key={shipmentId} className="flex items-center gap-2 px-3 py-1.5 text-[0.8125rem]">
              <span className="text-ink-tertiary w-14 shrink-0">{A.stop(index + 1)}</span>
              <span className={`text-ink-primary font-medium ${MONO}`}>{shipment.code}</span>
              <span className={`text-ink-secondary text-xs ${MONO}`}>
                {shipment.orderNumber ?? ""}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="text-ink-secondary hover:bg-bg-muted rounded p-1 disabled:opacity-40"
                  disabled={disabled || index === 0}
                  aria-label={A.upAria(shipment.code)}
                  onClick={() => onMove(index, -1)}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="text-ink-secondary hover:bg-bg-muted rounded p-1 disabled:opacity-40"
                  disabled={disabled || index === order.length - 1}
                  aria-label={A.downAria(shipment.code)}
                  onClick={() => onMove(index, 1)}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
