"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { useManifest } from "@/features/shipping/queries";

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
  // Người nhận + địa chỉ giao của từng điểm lấy từ biên bản của xe (theo mã lô); chưa tải được thì chỉ còn mã lô
  const manifest = useManifest(load.loadId).data;
  const recipients = new Map(manifest?.shipments.map((row) => [row.shipmentCode, row]));
  return (
    <div>
      <p className="text-ink-secondary mb-1 text-xs font-medium">{A.stops}</p>
      <p className="text-ink-tertiary mb-2 text-xs">{A.stopsHint}</p>
      <ol className="border-border-default divide-border-default divide-y rounded-[var(--r-sm)] border">
        {order.map((shipmentId, index) => {
          const shipment = byId.get(shipmentId);
          if (!shipment) return null;
          const to = recipients.get(shipment.code);
          const where = [to?.recipientName, to?.deliveryAddress].filter(Boolean).join(" — ");
          return (
            <li key={shipmentId} className="flex items-center gap-2 px-3 py-1.5 text-[0.8125rem]">
              <span className="text-ink-tertiary w-14 shrink-0 self-start pt-0.5">
                {A.stop(index + 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-ink-primary font-medium ${MONO}`}>{shipment.code}</span>
                  {/* Mã lô là "<số đơn>-S<n>": số đơn chỉ hiện khi không nằm sẵn trong mã lô (không lặp cạnh nhau) */}
                  {shipment.orderNumber && !shipment.code.startsWith(shipment.orderNumber) && (
                    <span className={`text-ink-secondary text-xs ${MONO}`}>
                      {shipment.orderNumber}
                    </span>
                  )}
                </span>
                {where && <span className="text-ink-secondary block text-xs">{where}</span>}
              </span>
              {/* Một điểm giao thì không có thứ tự để đổi: ẩn mũi tên lên / xuống */}
              {order.length > 1 && (
                <span className="flex items-center gap-1">
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
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
