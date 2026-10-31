"use client";

import { Group, Line, Rect } from "react-konva";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { LINE } from "../../map/shape-utils";

import type { CanvasPalette } from "./use-canvas-palette";

const range = (extent: number, step: number) =>
  Array.from({ length: Math.floor(extent / step) }, (_, i) => (i + 1) * step);

/**
 * Nền bản đồ: khung kho + lưới 1 m / 5 m (đơn vị mét). Hình chữ nhật nền tên `background` là chỗ bấm để
 * vẽ / bỏ chọn — lưới không nhận chuột để không chặn thao tác.
 */
export function GridLayer({
  width,
  height,
  palette,
}: {
  width: number;
  height: number;
  palette: CanvasPalette;
}) {
  return (
    <Group>
      <Rect name="background" width={width} height={height} fill={palette.surface} />
      <Group listening={false}>
        {range(width, LIMITS.gridMinor).map((x) => (
          <Line
            key={`gx${x}`}
            points={[x, 0, x, height]}
            stroke={palette.border}
            strokeWidth={x % LIMITS.gridMajor === 0 ? LINE.thin * 1.5 : LINE.thin / 2}
          />
        ))}
        {range(height, LIMITS.gridMinor).map((y) => (
          <Line
            key={`gy${y}`}
            points={[0, y, width, y]}
            stroke={palette.border}
            strokeWidth={y % LIMITS.gridMajor === 0 ? LINE.thin * 1.5 : LINE.thin / 2}
          />
        ))}
        <Rect width={width} height={height} stroke={palette.strong} strokeWidth={LINE.base} />
      </Group>
    </Group>
  );
}
