"use client";

import { UI_LABELS } from "@/constants";
import { formatTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { Button } from "@/components/ui/button";

import { ParcelBadges } from "../ftl/ParcelBadges";
import { MONO, NUM } from "../primitives";

import type { LoadShipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;

/** Kiện của một lô trên chuyến: đã lên xe lúc nào; gỡ khỏi xe được trước bàn giao. */
export function ShipmentParcels({
  shipment,
  canUnscan,
  unscanning,
  onUnscan,
}: {
  shipment: LoadShipment;
  canUnscan: boolean;
  unscanning: boolean;
  onUnscan: (shipment: LoadShipment, packageId: string) => void;
}) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{`${L.parcels} ${shipment.code}`}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {L.parcelCode}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {L.parcelWeight}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {L.parcelLoadedAt}
            </th>
            {canUnscan && <th scope="col" className="w-px px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {shipment.packages.map((parcel) => (
            <tr key={parcel.packageId} className="border-border-default border-t">
              <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>
                {parcel.labelCode}
                <ParcelBadges parcel={parcel} />
              </td>
              <td className={`text-ink-primary px-3 py-2 ${NUM}`}>
                {parcel.weightKg == null ? "—" : formatNumber(parcel.weightKg)}
              </td>
              <td
                className={`px-3 py-2 tabular-nums ${parcel.loaded ? "text-ink-secondary" : "text-warning"}`}
              >
                {parcel.loaded && parcel.loadedAt ? formatTime(parcel.loadedAt) : L.notLoaded}
              </td>
              {canUnscan && (
                <td className="px-3 py-1 text-right">
                  {parcel.loaded && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={unscanning}
                      aria-label={`${L.unscanAria} ${parcel.labelCode}`}
                      onClick={() => onUnscan(shipment, parcel.packageId)}
                    >
                      {L.unscan}
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
