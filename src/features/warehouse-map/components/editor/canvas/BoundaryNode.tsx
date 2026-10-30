"use client";

import { Circle, Group, Line } from "react-konva";

import { BOUNDARY_TYPE } from "@/constants";

import { clampPoint, snap, toMm } from "@/features/warehouse-map/draft-geometry";

import { LINE } from "../../map/shape-utils";

import type { KonvaEventObject } from "konva/lib/Node";
import type { DraftBoundary, DraftItem } from "@/features/warehouse-map/draft";
import type { MapFrame, MapPoint } from "@/features/warehouse-map/draft-geometry";
import type { CanvasPalette } from "./use-canvas-palette";

/** Bán kính tay nắm đầu mút (m) — đủ lớn để bấm trúng khi phóng nhỏ. */
const HANDLE = 0.35;

interface BoundaryNodeProps {
  line: DraftBoundary;
  frame: MapFrame;
  palette: CanvasPalette;
  selected: boolean;
  editable: boolean;
  invalid: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onChange: (apply: (item: DraftItem) => DraftItem) => void;
}

const snapped = (point: MapPoint, frame: MapFrame) =>
  clampPoint({ x: snap(point.x), y: snap(point.y) }, frame);

/**
 * Tường (nét liền đậm) / cửa (nét đứt; xanh khi mở, cam khi đóng). Chọn rồi kéo cả đoạn, hoặc kéo tay
 * nắm hai đầu; mọi đầu mút bám lưới và nằm trong khung (BR-06).
 */
export function BoundaryNode(props: BoundaryNodeProps) {
  const { line, frame, palette, selected, editable, invalid } = props;
  const door = line.type === BOUNDARY_TYPE.DOOR;
  const color = invalid
    ? palette.danger
    : door
      ? line.operationalStatus === "CLOSED"
        ? palette.warning
        : palette.info
      : palette.ink;
  const patch = (next: Partial<DraftBoundary>) =>
    props.onChange((item) => (item.kind === "boundary" ? { ...item, ...next } : item));

  const moveEnd = (end: "start" | "end") => (event: KonvaEventObject<DragEvent>) => {
    const point = snapped(event.target.position(), frame);
    event.target.position(point);
    if (event.type === "dragend")
      patch(
        end === "start" ? { startX: point.x, startY: point.y } : { endX: point.x, endY: point.y },
      );
  };

  return (
    <Group>
      <Group
        draggable={editable && selected}
        onMouseDown={props.onSelect}
        onTap={props.onSelect}
        onDblClick={props.onOpen}
        onDblTap={props.onOpen}
        onDragMove={(event) => {
          // Vị trí nhóm là độ dời của cả đoạn (âm được) — chỉ bám lưới; ra ngoài khung thì luật báo lỗi
          const { x, y } = event.target.position();
          event.target.position({ x: snap(x), y: snap(y) });
        }}
        onDragEnd={(event) => {
          const { x: dx, y: dy } = event.target.position();
          event.target.position({ x: 0, y: 0 });
          patch({
            startX: toMm(line.startX + dx),
            startY: toMm(line.startY + dy),
            endX: toMm(line.endX + dx),
            endY: toMm(line.endY + dy),
          });
        }}
      >
        <Line
          points={[line.startX, line.startY, line.endX, line.endY]}
          stroke={color}
          strokeWidth={selected ? LINE.wall * 1.4 : LINE.wall}
          hitStrokeWidth={LINE.wall * 4}
          dash={door ? [0.5, 0.3] : undefined}
          lineCap="square"
        />
      </Group>
      {selected && editable && (
        <>
          <Circle
            x={line.startX}
            y={line.startY}
            radius={HANDLE}
            fill={palette.surface}
            stroke={palette.info}
            strokeWidth={LINE.base}
            draggable
            onDragMove={moveEnd("start")}
            onDragEnd={moveEnd("start")}
          />
          <Circle
            x={line.endX}
            y={line.endY}
            radius={HANDLE}
            fill={palette.surface}
            stroke={palette.info}
            strokeWidth={LINE.base}
            draggable
            onDragMove={moveEnd("end")}
            onDragEnd={moveEnd("end")}
          />
        </>
      )}
    </Group>
  );
}
