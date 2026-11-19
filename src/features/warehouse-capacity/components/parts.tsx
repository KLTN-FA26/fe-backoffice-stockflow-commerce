import { cn } from "cn";

import { UI_LABELS, WAREHOUSE_CAPACITY_LIMITS as LIMITS } from "@/constants";
import { formatDecimal, formatPercent } from "@/lib/format";

import { usageTone } from "@/features/warehouse-capacity/selectors";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";

import type { CapacityTone } from "@/features/warehouse-capacity/selectors";

const L = UI_LABELS.warehouseCapacity;

/** m³ không kèm đơn vị (cột đã ghi đơn vị ở header): BE 3 số lẻ, bỏ số 0 thừa. */
export const formatM3 = (m3: number) => formatDecimal(m3, LIMITS.volumeDecimals);
/** m³ kèm đơn vị — câu chữ, ô số liệu lớn. */
export const formatM3Unit = (m3: number) => `${formatM3(m3)} ${L.unitM3}`;
/** BE trả phần trăm 0–100. */
export const formatShare = (percent: number) =>
  formatPercent(percent / 100, LIMITS.percentDecimals);

/** Thang `--dot-*` chỉ cho thanh / chấm; chữ vẫn màu status gốc (design-tokens: Chấm trạng thái). */
export const TONE_FILL: Record<CapacityTone | "special", string> = {
  positive: "bg-dot-positive",
  info: "bg-dot-info",
  warning: "bg-dot-warning",
  danger: "bg-dot-danger",
  neutral: "bg-neutral",
  special: "bg-dot-special",
};

/** Số m³ căn phải, mono tabular; âm (thiếu chỗ — BR-21) tô `danger`. */
export function VolumeText({ m3, muted = false }: { m3: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        CELL.number,
        muted && "text-ink-secondary font-normal",
        m3 < 0 && "text-danger",
      )}
    >
      {formatM3(m3)}
    </span>
  );
}

/** Thanh mảnh + % đang chiếm. Chưa có sức chứa (kho chưa có bin tính được thể tích, khu vực) → "—". */
export function UsageBar({
  percent,
  label,
}: {
  percent: number | null | undefined;
  label: string;
}) {
  if (percent === null || percent === undefined) return <EmptyCell />;
  const tone = usageTone(percent);
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={formatShare(percent)}
        className="bg-bg-muted h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
      >
        <div
          className={cn("h-full rounded-full", TONE_FILL[tone])}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={cn(CELL.number, "w-12 text-right", tone === "danger" && "text-danger")}>
        {formatShare(percent)}
      </span>
    </div>
  );
}
