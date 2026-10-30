"use client";

import { cn } from "cn";

import { LOCATION_STATUS } from "@/constants";

import { boxOf, planLevel, shelfTransform } from "@/features/warehouse-map/selectors";

import { fitLabel, LINE, P, selectProps, statusText } from "./shape-utils";
import { StatusMarker } from "./StatusMarker";

import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { Selectable } from "./shape-utils";

/**
 * Kệ trên mặt bằng: khối bo góc nền màu zone nhạt + viền cùng màu zone (màu là dữ liệu BE), vạch chia
 * bin của tầng thấp nhất, cạnh đậm = mặt lấy hàng; trạng thái hiệu lực chỉ hiện chấm góc khi KHÔNG
 * đang dùng (đỡ rối). Mã kệ tự co theo kích thước, kệ đứng thì chữ xoay dọc. Tầng là chiều cao nên
 * KHÔNG vẽ chồng trên mặt bằng.
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
  const label = fitLabel(shelf.code, box.w, box.h);
  const faces = shelf.pickFaces;
  const face = (x1: number, y1: number, x2: number, y2: number) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className="stroke-ink-secondary"
      strokeWidth={LINE.bold}
      strokeLinecap="round"
    />
  );
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return (
    <g
      {...selectProps(
        `${P.shelf} ${shelf.code} — ${statusText(shelf.effectiveStatus)}`,
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
          rx={0.3}
          className="fill-dot-info stroke-dot-info"
          fillOpacity={0.08}
          strokeWidth={LINE.base}
        />
      )}
      <g transform={`translate(${tx} ${ty}) rotate(${deg})`}>
        <rect
          width={w}
          height={l}
          rx={0.12}
          className={cn(
            "transition-[stroke-width,fill-opacity] duration-150 group-hover:[stroke-width:0.18] group-hover:[fill-opacity:0.42]",
            !zoneColor && "fill-bg-muted stroke-border-strong",
          )}
          // Độ mờ là thuộc tính (không phải style) để class hover ghi đè được
          style={zoneColor ? { fill: zoneColor, stroke: zoneColor } : undefined}
          fillOpacity={zoneColor ? 0.22 : 1}
          strokeWidth={LINE.base}
          strokeDasharray={inactive ? "0.4 0.3" : undefined}
        />
        {planLevel(shelf)?.bins.map((bin) => (
          <rect
            key={bin.id}
            x={bin.footprint.x}
            y={bin.footprint.y}
            width={bin.footprint.width}
            height={bin.footprint.length}
            className="stroke-border-strong fill-none"
            strokeOpacity={0.7}
            strokeWidth={LINE.thin}
          />
        ))}
        {faces.north && face(0, 0, w, 0)}
        {faces.south && face(0, l, w, l)}
        {faces.west && face(0, 0, 0, l)}
        {faces.east && face(w, 0, w, l)}
      </g>
      <rect
        x={box.x - 0.15}
        y={box.y - 0.15}
        width={box.w + 0.3}
        height={box.h + 0.3}
        rx={0.2}
        className="focus-ring fill-none stroke-transparent"
        strokeWidth={LINE.base}
      />
      {label && (
        <text
          x={cx}
          y={cy}
          fontSize={label.size}
          textAnchor="middle"
          dominantBaseline="central"
          transform={label.vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
          className="fill-ink-primary pointer-events-none font-[family-name:var(--font-mono)] font-semibold"
        >
          {shelf.code}
        </text>
      )}
      <StatusMarker status={shelf.effectiveStatus} x={box.x + box.w} y={box.y} />
    </g>
  );
}
