/**
 * Hiển thị loại xe — thuần, không side effect. Kích thước BE tính bằng mm; màn hình hiện mét (một
 * thùng container 12 m dễ đọc hơn 12.032 mm), mm nằm ở tooltip. Thể tích thùng = D × R × C (mm³ → m³).
 */

import { UI_LABELS, VEHICLE_TYPE_LIMITS as LIMITS } from "@/constants";
import { formatFixed, formatNumber } from "@/lib/format";

import type { VehicleType } from "./types";

const L = UI_LABELS.vehicleType;

/** Một cạnh: 5898 → "5,898". */
export function formatMetres(mm: number): string {
  return formatFixed(mm / LIMITS.mmPerMetre, 3);
}

/** "5,898 × 2,352 × 2,393 m". */
export function formatInnerSizeMetres(
  row: Pick<VehicleType, "innerLengthMm" | "innerWidthMm" | "innerHeightMm">,
): string {
  const sides = [row.innerLengthMm, row.innerWidthMm, row.innerHeightMm].map(formatMetres);
  return `${sides.join(" × ")} ${L.unitM}`;
}

/** Tooltip: "5.898 × 2.352 × 2.393 mm". */
export function formatInnerSizeMm(
  row: Pick<VehicleType, "innerLengthMm" | "innerWidthMm" | "innerHeightMm">,
): string {
  const sides = [row.innerLengthMm, row.innerWidthMm, row.innerHeightMm].map(formatNumber);
  return `${sides.join(" × ")} ${L.unitMm}`;
}

/** Thể tích thùng (m³) từ ba cạnh bằng mm; thiếu / không hợp lệ → `null`. */
export function volumeM3(
  lengthMm: number | undefined,
  widthMm: number | undefined,
  heightMm: number | undefined,
): number | null {
  const sides = [lengthMm, widthMm, heightMm];
  if (sides.some((side) => side === undefined || !Number.isFinite(side) || side <= 0)) return null;
  const [l = 0, w = 0, h = 0] = sides;
  return (l * w * h) / LIMITS.cubicMmPerCubicMetre;
}

/** "33,20 m³" (2 số lẻ). */
export function formatVolume(volume: number): string {
  return `${formatFixed(volume, 2)} ${L.unitM3}`;
}

/** "28.200 kg" (tối đa 3 số lẻ như BE). */
export function formatPayload(kg: number): string {
  return `${formatNumber(kg)} ${L.unitKg}`;
}
