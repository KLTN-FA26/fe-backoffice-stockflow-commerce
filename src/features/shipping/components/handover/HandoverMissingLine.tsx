"use client";

import { useWatch } from "react-hook-form";

import { UI_LABELS } from "@/constants";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;

/**
 * Dòng "Còn thiếu: …" dưới các ô (R7, FE#292 U46): nói ô nào còn khoá nút xác nhận — tên tài xế (nếu chuyến chưa có),
 * người ký, biển số (nếu chưa có), mã vận đơn (BR-23), tick đã ký. Hết thiếu thì không hiện gì.
 */
export function HandoverMissingLine({
  form,
  load,
  noWaybill,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  load: Load;
  noWaybill: boolean;
}) {
  const [driverName, representative, vehiclePlate, signed] = useWatch({
    control: form.control,
    name: ["driverName", "carrierRepresentative", "vehiclePlate", "signed"],
  });
  const missing: string[] = [];
  if (!load.driverName && !driverName?.trim()) missing.push(H.missing.driverName);
  if (!representative?.trim()) missing.push(H.missing.representative);
  if (!load.vehiclePlate && !vehiclePlate?.trim()) missing.push(H.missing.vehiclePlate);
  if (noWaybill) missing.push(H.missing.waybill);
  if (signed !== true) missing.push(H.missing.signed);
  if (missing.length === 0) return null;
  return (
    <p className="text-ink-secondary text-xs" aria-live="polite">
      {H.missing.prefix}: {missing.join(", ")}
    </p>
  );
}
