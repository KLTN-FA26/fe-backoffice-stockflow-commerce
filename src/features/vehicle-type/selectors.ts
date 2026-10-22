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

/** Cửa thùng: "2340×2280"; một phía chưa đặt hiện "—" ở phía đó; cả hai null = không giới hạn → "—". */
export function formatDoorMm(row: Pick<VehicleType, "doorWidthMm" | "doorHeightMm">): string {
  const { doorWidthMm: width, doorHeightMm: height } = row;
  if (width == null && height == null) return L.noDoor;
  return `${width ?? L.noDoor}×${height ?? L.noDoor}`;
}

/** Một cạnh hợp lệ theo BE (`@Min(1) @Max(30000)`, số nguyên mm). */
export function isValidDimensionMm(mm: number | undefined): mm is number {
  return mm !== undefined && Number.isInteger(mm) && mm >= 1 && mm <= LIMITS.dimensionMaxMm;
}

/** Thể tích thùng (m³) từ ba cạnh bằng mm; thiếu hoặc ngoài giới hạn BE → `null`. */
export function volumeM3(
  lengthMm: number | undefined,
  widthMm: number | undefined,
  heightMm: number | undefined,
): number | null {
  const sides = [lengthMm, widthMm, heightMm];
  // Cùng luật với form / BE: số nguyên 1..30.000 mm — nằm ngoài thì không có thể tích đáng tin để hiện
  if (sides.some((side) => !isValidDimensionMm(side))) return null;
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
