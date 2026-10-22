"use client";

import { formatNumber } from "@/lib/format/number";

import { MONO } from "../copy";

import type { PendingHold } from "@/features/production-order/types";

/**
 * Các phiếu giữ phôi còn phải quét (SCRUM-410, `GET …/material-issues/pending`), cũ nhất trước — đi tới vị trí,
 * quét vị trí rồi quét SKU / mã vạch. Chọn dòng = phiếu sẽ xuất ở lần quét tới.
 */
export function PendingHoldList({
  holds,
  selected,
  onSelect,
  selectable,
}: {
  holds: readonly PendingHold[];
  selected: string;
  onSelect: (reservationId: string) => void;
  selectable: boolean;
}) {
  return (
    <table className="w-full text-[0.8125rem]">
      <caption className="text-ink-secondary mb-1 text-left text-xs">
        Phiếu giữ còn phải quét ({holds.length})
      </caption>
      <thead className="text-ink-tertiary text-left">
        <tr>
          {selectable && (
            <th scope="col" className="w-8 py-1">
              <span className="sr-only">Chọn</span>
            </th>
          )}
          <th scope="col" className="py-1">
            Vị trí
          </th>
          <th scope="col">Phôi / lô</th>
          <th scope="col">Mã vạch</th>
          <th scope="col" className="text-right">
            SL
          </th>
        </tr>
      </thead>
      <tbody>
        {holds.map((hold) => (
          <tr
            key={hold.reservationId}
            className={`border-border-default border-t ${hold.reservationId === selected ? "bg-bg-muted" : ""}`}
          >
            {selectable && (
              <td className="py-1">
                <input
                  type="radio"
                  name="pending-hold"
                  aria-label={`Xuất phiếu giữ tại ${hold.locationCode}`}
                  checked={hold.reservationId === selected}
                  onChange={() => onSelect(hold.reservationId)}
                  className="accent-[var(--brand)]"
                />
              </td>
            )}
            <td className={`py-1 ${MONO}`}>{hold.locationCode}</td>
            <td className={MONO}>
              {hold.sku}
              {hold.lotNumber ? ` · ${hold.lotNumber}` : ""}
            </td>
            <td className={MONO}>{hold.barcode ?? "—"}</td>
            <td className={`text-right ${MONO}`}>{formatNumber(hold.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
