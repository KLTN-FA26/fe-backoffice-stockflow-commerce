"use client";

import { Line, Rect } from "react-konva";

import { LINE } from "../../map/shape-utils";

import type { MapLine } from "@/features/warehouse-map/draft-edit";
import type { MapBox } from "@/features/warehouse-map/selectors";
import type { CanvasPalette } from "./use-canvas-palette";

const DASH = [0.4, 0.3];

/** Khung / đoạn đang kéo để vẽ — đã bám lưới, là đúng hình sẽ vào bản nháp khi thả chuột. */
export function DrawPreview({
  shape,
  palette,
}: {
  shape: MapBox | MapLine;
  palette: CanvasPalette;
}) {
  if ("startX" in shape)
    return (
      <Line
        points={[shape.startX, shape.startY, shape.endX, shape.endY]}
        stroke={palette.info}
        strokeWidth={LINE.wall}
        dash={DASH}
        listening={false}
      />
    );
  return (
    <Rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      stroke={palette.info}
      strokeWidth={LINE.base}
      dash={DASH}
      listening={false}
    />
  );
}
