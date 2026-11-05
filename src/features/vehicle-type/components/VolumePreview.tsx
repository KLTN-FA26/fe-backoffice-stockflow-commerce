"use client";

import { useWatch } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { formatVolume, volumeM3 } from "@/features/vehicle-type/selectors";

import type { Control } from "react-hook-form";
import type { VehicleTypeFormInput, VehicleTypeFormValues } from "@/features/vehicle-type/types";

const F = UI_LABELS.vehicleType.form;

/** Thể tích thùng (m³) tính từ ba cạnh đang nhập (mm); chưa đủ số hợp lệ thì nhắc nhập. */
export function VolumePreview({
  control,
}: {
  control: Control<VehicleTypeFormInput, unknown, VehicleTypeFormValues>;
}) {
  const [length, width, height] = useWatch({
    control,
    name: ["innerLengthMm", "innerWidthMm", "innerHeightMm"],
  });
  const toMm = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw) : undefined);
  const volume = volumeM3(toMm(length), toMm(width), toMm(height));
  return (
    <p
      aria-live="polite"
      className="bg-bg-subtle border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]"
    >
      {F.volumeLabel}:{" "}
      {volume === null ? (
        <span className="text-ink-tertiary">{F.volumeEmpty}</span>
      ) : (
        <strong className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">
          {formatVolume(volume)}
        </strong>
      )}
    </p>
  );
}
