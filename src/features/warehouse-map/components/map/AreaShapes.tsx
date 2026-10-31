"use client";

import { cn } from "cn";

import { AREA_TYPE, AREA_TYPE_LABELS, BOUNDARY_TYPE, LOCATION_STATUS } from "@/constants";

import { boxOf } from "@/features/warehouse-map/selectors";

import { fitLabel, LABEL_SIZE, LINE, P, selectProps, statusText } from "./shape-utils";
import { StatusMarker } from "./StatusMarker";

import type { Boundary, LayoutArea } from "@/features/warehouse-map/types";
import type { Selectable } from "./shape-utils";

/** Lề chữ trong khu vực (m). */
const INSET = 0.4;

/**
 * Khu vực trên sàn: khối bo góc viền đứt mảnh; khu chứa hàng nền sáng, khu NON_STORAGE (văn phòng…)
 * nền xám — không phải vị trí tồn kho (BR-11). Nhãn mã + loại ở góc trên-trái, tự ẩn dòng loại khi khu
 * quá thấp; chấm trạng thái chỉ khi không đang dùng.
 */
export function AreaShape({ area, selected, onSelect }: Selectable & { area: LayoutArea }) {
  const box = boxOf(area.footprint);
  const inactive = area.status === LOCATION_STATUS.INACTIVE;
  const storage = area.type !== AREA_TYPE.NON_STORAGE;
  const code = fitLabel(area.code, box.w - INSET, box.h);
  const type = AREA_TYPE_LABELS[area.type];
  const typeSize = Math.min(LABEL_SIZE * 0.8, (code?.size ?? 0) * 0.85);
  const showType = code !== null && box.h > code.size + typeSize * 1.6 + INSET * 2;
  return (
    <g
      {...selectProps(
        `${P.area} ${area.code} ${area.name} — ${statusText(area.effectiveStatus)}`,
        onSelect,
        selected,
      )}
      opacity={inactive ? 0.45 : 1}
    >
      {selected && (
        <rect
          x={box.x - 0.25}
          y={box.y - 0.25}
          width={box.w + 0.5}
          height={box.h + 0.5}
          rx={0.4}
          className="fill-dot-info stroke-dot-info"
          fillOpacity={0.08}
          strokeWidth={LINE.base}
        />
      )}
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={0.25}
        className={cn(
          "stroke-border-strong group-hover:stroke-ink-tertiary transition-[stroke,fill-opacity] duration-150 group-hover:[fill-opacity:0.6]",
          storage ? "fill-bg-surface" : "fill-bg-muted",
        )}
        strokeWidth={LINE.base}
        strokeDasharray="0.45 0.3"
      />
      <rect
        x={box.x - 0.15}
        y={box.y - 0.15}
        width={box.w + 0.3}
        height={box.h + 0.3}
        rx={0.35}
        className="focus-ring fill-none stroke-transparent"
        strokeWidth={LINE.base}
      />
      {code && (
        <text
          x={box.x + INSET}
          y={box.y + INSET}
          fontSize={code.size}
          dominantBaseline="hanging"
          className="pointer-events-none"
        >
          <tspan className="fill-ink-primary font-[family-name:var(--font-mono)] font-semibold">
            {area.code}
          </tspan>
          {showType && (
            <tspan
              x={box.x + INSET}
              dy={code.size * 1.35}
              fontSize={typeSize}
              className="fill-ink-tertiary"
            >
              {type}
            </tspan>
          )}
        </text>
      )}
      <StatusMarker status={area.effectiveStatus} x={box.x + box.w} y={box.y} />
    </g>
  );
}

/**
 * Tường: nét xám đậm đầu tròn. Cửa: nét đứt + chấm hai đầu — xanh khi mở, cam khi đóng
 * (BoundaryResponse.operationalStatus).
 */
export function BoundaryLine({ boundary }: { boundary: Boundary }) {
  const door = boundary.type === BOUNDARY_TYPE.DOOR;
  // Tên class đầy đủ (Tailwind không quét được class ghép động)
  const closed = boundary.operationalStatus === "CLOSED";
  const stroke = closed ? "stroke-dot-warning" : "stroke-dot-info";
  const fill = closed ? "fill-dot-warning" : "fill-dot-info";
  const ends = [
    [boundary.startX, boundary.startY],
    [boundary.endX, boundary.endY],
  ] as const;
  return (
    <g className="pointer-events-none">
      <line
        x1={boundary.startX}
        y1={boundary.startY}
        x2={boundary.endX}
        y2={boundary.endY}
        className={cn(!door && "stroke-ink-secondary", door && stroke)}
        strokeWidth={door ? LINE.wall * 0.8 : LINE.wall}
        strokeDasharray={door ? "0.5 0.3" : undefined}
        strokeLinecap="round"
      />
      {door &&
        ends.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={0.2} className={fill} />)}
    </g>
  );
}
