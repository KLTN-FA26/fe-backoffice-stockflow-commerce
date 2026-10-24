import { PACKAGE_STATUS_DISPLAY, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { StatusDot } from "@/components/shared/StatusDot";

import { ParcelBadges } from "../ftl/ParcelBadges";
import { MONO, NUM, Section } from "../primitives";

import type { Shipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.shipment;

/** Kiện trong lô + lịch sử các bước (ai ghi nhận, lúc nào — docs 09 BR-02). */
export function ShipmentDetails({ data }: { data: Shipment }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title={`${L.packages} (${data.packages.length})`}>
        <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">{L.packages}</caption>
            <thead className="bg-bg-subtle text-ink-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {L.parcelCode}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {L.parcelStatus}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {UI_LABELS.shipping.load.parcelWeight}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.packages.map((parcel) => (
                <tr key={parcel.packageId} className="border-border-default border-t">
                  <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>
                    {parcel.labelCode}
                    <ParcelBadges parcel={parcel} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusDot domain="shipment" status={PACKAGE_STATUS_DISPLAY[parcel.status]} />
                  </td>
                  <td className={`text-ink-primary px-3 py-2 ${NUM}`}>
                    {parcel.weightKg == null ? "—" : formatNumber(parcel.weightKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={L.timeline}>
        {data.timeline.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">{L.timelineEmpty}</p>
        ) : (
          <ol className="space-y-2 text-[0.8125rem]">
            {data.timeline.map((step, index) => (
              <li
                key={`${step.status}-${step.occurredAt}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3"
              >
                <StatusDot domain="shipment" status={PACK_SHIPMENT_STATUS_DISPLAY[step.status]} />
                <span className="text-ink-secondary tabular-nums">
                  {formatDateTime(step.occurredAt)}
                </span>
                {step.recordedByName && (
                  <span className="text-ink-secondary">
                    {L.timelineWho}: {step.recordedByName}
                  </span>
                )}
                {step.note && <span className="text-ink-tertiary">— {step.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
