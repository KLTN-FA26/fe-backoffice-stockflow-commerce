"use client";

import { cn } from "cn";

import { LOCATION_STATUS } from "@/constants";

import { boxOf, planLevel, shelfTransform } from "@/features/warehouse-map/selectors";

import { LABEL_SIZE, LINE, P, selectProps, statusText } from "./shape-utils";
import { locationTone, TONE_STROKE } from "./tone";

import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { Selectable } from "./shape-utils";

/**
 * Kệ trên mặt bằng: khung theo zone (màu là dữ liệu), viền theo `effectiveStatus`, vạch chia bin của
 * tầng thấp nhất, cạnh đậm = mặt lấy hàng. Tầng là chiều cao nên KHÔNG vẽ chồng trên mặt bằng.
 */
export function ShelfShape({
  shelf,
  zoneColor,
  selected,
  onSelect,
}: Selectable & { shelf: LayoutShelf; zoneColor?: string }) {
  const { tx, ty, deg } = shelfTransform(shelf.footprint);
  const { width: w, length: l } = shelf.footprint;
  const box = boxOf(shelf.footprint);
  const inactive = shelf.status === LOCATION_STATUS.INACTIVE;
  const tone = TONE_STROKE[locationTone(shelf.effectiveStatus)];
  const faces = shelf.pickFaces;
  const label = `${P.shelf} ${shelf.code} — ${statusText(shelf.effectiveStatus)}`;
  return (
    <g {...selectProps(label, onSelect, selected)} opacity={inactive ? 0.45 : 1}>
      <g transform={`translate(${tx} ${ty}) rotate(${deg})`}>
        <rect
          width={w}
          height={l}
          className={cn(zoneColor ? undefined : "fill-bg-muted", tone)}
          style={zoneColor ? { fill: zoneColor, fillOpacity: 0.28 } : undefined}
          strokeWidth={selected ? LINE.bold : LINE.base}
          strokeDasharray={inactive ? "0.4 0.3" : undefined}
        />
        {planLevel(shelf)?.bins.map((bin) => (
          <rect
            key={bin.id}
            x={bin.footprint.x}
            y={bin.footprint.y}
            width={bin.footprint.width}
            height={bin.footprint.length}
            className="stroke-ink-tertiary fill-none"
            strokeWidth={LINE.thin}
          />
        ))}
        {faces.north && (
          <line x1={0} x2={w} y1={0} y2={0} className={tone} strokeWidth={LINE.bold} />
        )}
        {faces.south && (
          <line x1={0} x2={w} y1={l} y2={l} className={tone} strokeWidth={LINE.bold} />
        )}
        {faces.west && (
          <line x1={0} x2={0} y1={0} y2={l} className={tone} strokeWidth={LINE.bold} />
        )}
        {faces.east && (
          <line x1={w} x2={w} y1={0} y2={l} className={tone} strokeWidth={LINE.bold} />
        )}
      </g>
      <rect
        x={box.x - 0.15}
        y={box.y - 0.15}
        width={box.w + 0.3}
        height={box.h + 0.3}
        className={cn("focus-ring fill-none", selected ? "stroke-dot-info" : "stroke-transparent")}
        strokeWidth={LINE.base}
      />
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2}
        fontSize={LABEL_SIZE}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink-primary pointer-events-none font-[family-name:var(--font-mono)] font-semibold"
      >
        {shelf.code}
      </text>
    </g>
  );
}
