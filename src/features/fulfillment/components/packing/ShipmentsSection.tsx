"use client";

import { PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, Section } from "../primitives";

import type { PackingSession } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing.shipments;
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Lô giao do bước hoàn tất tạo ra (`READY_TO_DISPATCH` → bàn giao hãng ở màn Xếp xe). Mỗi lần giao
 * một phần thêm một lô. Số tiền thu hộ (COD) hiện trên nhãn từng kiện — BE không kèm tiền tệ ở đây.
 */
export function ShipmentsSection({ session }: { session: PackingSession }) {
  if (session.shipments.length === 0) return null;
  return (
    <Section title={L.title} description={L.description}>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full">
          <caption className="sr-only">{L.title}</caption>
          <thead className="bg-bg-subtle border-border-default border-b">
            <tr>
              <th scope="col" className={`${TH} text-left`}>
                {L.code}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.status}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.packages}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.cod}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.readyAt}
              </th>
            </tr>
          </thead>
          <tbody>
            {session.shipments.map((shipment) => (
              <tr
                key={shipment.shipmentId}
                className="border-border-default border-b last:border-b-0"
              >
                <td className={`${TD} text-ink-primary ${MONO}`}>
                  {shipment.code}
                  {shipment.partial && (
                    <span
                      className="text-warning ml-2 text-xs font-normal"
                      title={shipment.partialNote ?? undefined}
                    >
                      {L.partial}
                    </span>
                  )}
                </td>
                <td className={TD}>
                  <StatusDot
                    domain="shipment"
                    status={PACK_SHIPMENT_STATUS_DISPLAY[shipment.status]}
                  />
                </td>
                <td className={`${TD} text-right ${MONO}`}>{shipment.packageCount}</td>
                <td className={`${TD} text-ink-secondary`}>
                  {(shipment.codAmount ?? 0) > 0 ? L.hasCod : L.noCod}
                </td>
                <td className={`${TD} text-ink-secondary tabular-nums`}>
                  {shipment.readyAt ? formatDateTime(shipment.readyAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
