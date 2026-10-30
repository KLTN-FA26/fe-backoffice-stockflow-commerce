"use client";

import { cn } from "cn";

import { AREA_TYPE_LABELS, BOUNDARY_TYPE, LOCATION_STATUS } from "@/constants";

import { boxOf } from "@/features/warehouse-map/selectors";

import { LABEL_SIZE, LINE, P, selectProps, statusText } from "./shape-utils";
import { locationTone, TONE_STROKE } from "./tone";

import type { Boundary, LayoutArea } from "@/features/warehouse-map/types";
import type { Selectable } from "./shape-utils";

/** Khu vực trên sàn: nét đứt, nền nhạt; khu NON_STORAGE không có trạng thái "dùng được" (BR-11). */
export function AreaShape({ area, selected, onSelect }: Selectable & { area: LayoutArea }) {
  const box = boxOf(area.footprint);
  const inactive = area.status === LOCATION_STATUS.INACTIVE;
  const label = `${P.area} ${area.code} ${area.name} — ${statusText(area.effectiveStatus)}`;
  return (
    <g {...selectProps(label, onSelect, selected)} opacity={inactive ? 0.45 : 1}>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        className={cn("fill-bg-subtle", TONE_STROKE[locationTone(area.effectiveStatus)])}
        strokeWidth={selected ? LINE.bold : LINE.base}
        strokeDasharray="0.6 0.35"
      />
      <rect
        x={box.x - 0.15}
        y={box.y - 0.15}
        width={box.w + 0.3}
        height={box.h + 0.3}
        className={cn("focus-ring fill-none", selected ? "stroke-dot-info" : "stroke-transparent")}
        strokeWidth={LINE.base}
      />
      <text
        x={box.x + 0.4}
        y={box.y + 0.5}
        fontSize={LABEL_SIZE}
        dominantBaseline="hanging"
        className="fill-ink-secondary pointer-events-none"
      >
        <tspan className="fill-ink-primary font-[family-name:var(--font-mono)] font-semibold">
          {area.code}
        </tspan>
        <tspan x={box.x + 0.4} dy={LABEL_SIZE * 1.3}>
          {AREA_TYPE_LABELS[area.type]}
        </tspan>
      </text>
    </g>
  );
}

/** Tường nét liền đậm; cửa nét đứt — xanh khi mở, cam khi đóng (BoundaryResponse.operationalStatus). */
export function BoundaryLine({ boundary }: { boundary: Boundary }) {
  const door = boundary.type === BOUNDARY_TYPE.DOOR;
  return (
    <line
      x1={boundary.startX}
      y1={boundary.startY}
      x2={boundary.endX}
      y2={boundary.endY}
      className={cn(
        !door && "stroke-ink-primary",
        door &&
          (boundary.operationalStatus === "CLOSED" ? "stroke-dot-warning" : "stroke-dot-info"),
      )}
      strokeWidth={LINE.wall}
      strokeDasharray={door ? "0.5 0.3" : undefined}
      strokeLinecap="square"
    />
  );
}
