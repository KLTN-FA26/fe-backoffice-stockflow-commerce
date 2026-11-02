"use client";

import { Line, Rect } from "react-konva";

import { LINE } from "../../map/shape-utils";

import type { DraftShelf } from "@/features/warehouse-map/draft";
import type { Footprint } from "@/features/warehouse-map/types";

const cuts = (count: number, extent: number) =>
  Array.from({ length: Math.max(0, count - 1) }, (_, i) => (extent * (i + 1)) / count);

/**
 * Bên trong kệ, trong khung cục bộ (trước khi xoay): ô bin đã có, hoặc lưới hàng × cột sẽ tự sinh
 * cho kệ mới (BR-14); cạnh đậm = mặt lấy hàng (Bắc là cạnh trên khi xoay 0°).
 */
export function ShelfDetail({
  shelf,
  bins,
  stroke,
  grid,
}: {
  shelf: DraftShelf;
  bins: readonly Footprint[];
  stroke: string;
  grid: string;
}) {
  const { width: w, length: l } = shelf.footprint;
  const build = shelf.build;
  const showGrid = build !== null && build.generateBins && build.levelCount > 0;
  const faces = shelf.pickFaces;
  return (
    <>
      {bins.map((bin, index) => (
        <Rect
          key={index}
          x={bin.x}
          y={bin.y}
          width={bin.width}
          height={bin.length}
          stroke={grid}
          strokeWidth={LINE.thin}
        />
      ))}
      {showGrid &&
        cuts(build.columnCount, w).map((x) => (
          <Line key={`c${x}`} points={[x, 0, x, l]} stroke={grid} strokeWidth={LINE.thin} />
        ))}
      {showGrid &&
        cuts(build.rowCount, l).map((y) => (
          <Line key={`r${y}`} points={[0, y, w, y]} stroke={grid} strokeWidth={LINE.thin} />
        ))}
      {faces.north && <Line points={[0, 0, w, 0]} stroke={stroke} strokeWidth={LINE.bold} />}
      {faces.south && <Line points={[0, l, w, l]} stroke={stroke} strokeWidth={LINE.bold} />}
      {faces.west && <Line points={[0, 0, 0, l]} stroke={stroke} strokeWidth={LINE.bold} />}
      {faces.east && <Line points={[w, 0, w, l]} stroke={stroke} strokeWidth={LINE.bold} />}
    </>
  );
}
