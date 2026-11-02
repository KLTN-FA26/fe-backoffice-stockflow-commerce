"use client";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { LINE } from "./shape-utils";

/** Cỡ chữ thước đo (m) — nhỏ hơn nhãn kệ để không tranh chú ý. */
const RULER_TEXT = 0.55;

const range = (extent: number, step: number) =>
  Array.from({ length: Math.floor(extent / step) }, (_, i) => (i + 1) * step);

/**
 * Sàn kho trên mặt bằng 2D: nền sàn tách khỏi phần ngoài khung, lưới 1 m rất mờ + vạch 5 m rõ hơn,
 * khung kho bo góc, thước đo mét mỗi 5 m dọc cạnh trên / trái. Không nhận chuột (bấm nền = bỏ chọn).
 */
export function MapFloor({ width, height }: { width: number; height: number }) {
  const major = (value: number) => value % LIMITS.gridMajor === 0;
  return (
    <g className="pointer-events-none">
      <rect width={width} height={height} rx={0.3} className="fill-bg-subtle" />
      {range(width, LIMITS.gridMinor).map((x) => (
        <line
          key={`gx${x}`}
          x1={x}
          x2={x}
          y1={0}
          y2={height}
          className="stroke-border-default"
          strokeWidth={major(x) ? LINE.thin : LINE.thin / 2}
          strokeOpacity={major(x) ? 0.9 : 0.45}
        />
      ))}
      {range(height, LIMITS.gridMinor).map((y) => (
        <line
          key={`gy${y}`}
          x1={0}
          x2={width}
          y1={y}
          y2={y}
          className="stroke-border-default"
          strokeWidth={major(y) ? LINE.thin : LINE.thin / 2}
          strokeOpacity={major(y) ? 0.9 : 0.45}
        />
      ))}
      <rect
        width={width}
        height={height}
        rx={0.3}
        className="stroke-border-strong fill-none"
        strokeWidth={LINE.base}
      />
      {[0, ...range(width, LIMITS.gridMajor)].map((x) => (
        <text
          key={`rx${x}`}
          x={x}
          y={-0.35}
          fontSize={RULER_TEXT}
          textAnchor="middle"
          className="fill-ink-tertiary tabular-nums"
        >
          {x}
        </text>
      ))}
      {range(height, LIMITS.gridMajor).map((y) => (
        <text
          key={`ry${y}`}
          x={-0.35}
          y={y}
          fontSize={RULER_TEXT}
          textAnchor="end"
          dominantBaseline="central"
          className="fill-ink-tertiary tabular-nums"
        >
          {y}
        </text>
      ))}
    </g>
  );
}
