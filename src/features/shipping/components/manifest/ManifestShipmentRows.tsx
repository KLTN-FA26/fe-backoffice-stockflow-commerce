import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format/number";

import { MONO, NUM } from "../primitives";

import type { ManifestShipment } from "@/features/shipping/types";

const M = UI_LABELS.shipping.manifest;

/**
 * Mỗi lô: một dòng tổng (mã lô, đơn, người nhận, số kiện, cân nặng, COD) rồi các kiện của lô kèm kích
 * thước và dấu đã lên xe. `codChangedSinceLabel`: số thu theo đơn khác nhãn — in kèm ghi chú.
 */
export function ManifestShipmentRows({
  shipments,
  money,
}: {
  shipments: readonly ManifestShipment[];
  money: (amount: number | null | undefined) => string;
}) {
  return (
    <>
      {shipments.map((shipment) => (
        <tbody
          key={shipment.shipmentCode}
          className="border-border-default break-inside-avoid border-t"
        >
          <tr>
            <td className="px-3 py-2 align-top">
              <div className={`text-ink-primary font-medium ${MONO}`}>{shipment.shipmentCode}</div>
              <div className={`text-ink-tertiary text-xs ${MONO}`}>
                {shipment.orderNumber ?? ""}
              </div>
            </td>
            <td className="px-3 py-2 align-top">
              <div className="text-ink-primary font-medium">{shipment.recipientName ?? "—"}</div>
              <div className={`text-ink-secondary text-xs ${MONO}`}>
                {shipment.recipientPhone ?? ""}
              </div>
              <div className="text-ink-secondary text-xs print:whitespace-normal">
                {shipment.deliveryAddress ?? ""}
              </div>
            </td>
            <td className={`text-ink-primary px-3 py-2 align-top ${NUM}`}>
              {shipment.packageCount}
            </td>
            <td className={`text-ink-primary px-3 py-2 align-top ${NUM}`}>
              {shipment.weightKg == null ? "—" : formatNumber(shipment.weightKg)}
            </td>
            <td className={`text-ink-primary px-3 py-2 align-top ${NUM}`}>
              {money(shipment.codAmount)}
              {shipment.codChangedSinceLabel && (
                <div className="text-warning text-xs font-normal">{M.codChanged}</div>
              )}
            </td>
          </tr>
          {shipment.packages.map((parcel) => (
            <tr key={parcel.labelCode} className="text-ink-secondary text-xs">
              <td className={`py-1 pl-6 ${MONO}`}>{parcel.labelCode}</td>
              <td className="px-3 py-1">
                {[parcel.lengthCm, parcel.widthCm, parcel.heightCm].every((v) => v != null)
                  ? `${parcel.lengthCm} × ${parcel.widthCm} × ${parcel.heightCm} cm`
                  : ""}
              </td>
              <td />
              <td className={`px-3 py-1 ${NUM}`}>
                {parcel.weightKg == null ? "—" : formatNumber(parcel.weightKg)}
              </td>
              <td className="px-3 py-1 text-right">
                {parcel.loaded ? (
                  <span className="text-positive inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden /> {M.loaded}
                  </span>
                ) : (
                  <span className="text-warning">{M.notLoaded}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </>
  );
}
