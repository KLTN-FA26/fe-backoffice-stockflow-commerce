"use client";

import { useRef, useState } from "react";
import { Layer, Stage } from "react-konva";

import { boxFromDrag, lineFromDrag } from "@/features/warehouse-map/draft-geometry";
import { planLevel } from "@/features/warehouse-map/selectors";

import { BoundaryNode } from "./BoundaryNode";
import { DrawPreview } from "./CanvasOverlays";
import { GridLayer } from "./GridLayer";
import { PlaceNode } from "./PlaceNode";
import { useCanvasPalette } from "./use-canvas-palette";
import { fitScale, useElementSize } from "../../shared/use-element-size";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { DraftItem, MapDraft } from "@/features/warehouse-map/draft";
import type { DraftTool, DrawnShape } from "@/features/warehouse-map/draft-edit";
import type { MapPoint } from "@/features/warehouse-map/draft-geometry";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/** Lề quanh khung (m) để nét viền, tay nắm và nhãn mép không bị cắt. */
const PAD = 1;

export interface EditorCanvasProps {
  layout: WarehouseLayout;
  draft: MapDraft;
  tool: DraftTool;
  zoom: number;
  /** `false` khi đang giữ Ctrl / ⌘ để dời bản đồ — canvas tạm không nhận chuột. */
  interactive: boolean;
  selectedKey: string | null;
  isEditable: (item: DraftItem) => boolean;
  isChanged: (item: DraftItem) => boolean;
  invalidKeys: ReadonlySet<string>;
  onSelect: (key: string | null) => void;
  /** Bấm đúp một hình → mở modal thông số. */
  onOpen: (key: string) => void;
  onDraw: (shape: DrawnShape) => void;
  onChange: (key: string, apply: (item: DraftItem) => DraftItem) => void;
}

interface Drag {
  start: MapPoint;
  end: MapPoint;
  orthogonal: boolean;
}

/**
 * Canvas sửa bản đồ (Konva, đơn vị mét, gốc góc trên-trái như BE `Footprint`). Công cụ vẽ: kéo trên nền
 * để tạo hình nháp; công cụ chọn: bấm hình để chọn, kéo để dời. Kệ / khu vực INACTIVE không vẽ (không
 * giữ chỗ — BR-07 — vẽ ra chỉ chồng lên hình đang dùng).
 */
export default function EditorCanvas(props: EditorCanvasProps) {
  const { layout, draft, tool, selectedKey } = props;
  const frame = layout.warehouse;
  const palette = useCanvasPalette();
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<Konva.Layer>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Zoom 1 = cả bản đồ nằm trọn trong khung (ngang lẫn dọc), không thanh cuộn
  const scale =
    fitScale(useElementSize(box), { width: frame.mapWidth, height: frame.mapHeight }, PAD) *
    props.zoom;
  const width = (frame.mapWidth + 2 * PAD) * scale;
  const zoneColors = new Map(
    draft.zones.flatMap((z) => (z.color ? [[z.key, z.color] as const] : [])),
  );
  const binsOf = new Map(
    layout.shelves.map((shelf) => [
      shelf.id,
      (planLevel(shelf)?.bins ?? []).map((bin) => bin.footprint),
    ]),
  );

  const pointer = () => layer.current?.getRelativePointerPosition() ?? null;
  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    // Chỉ chuột trái vẽ / chọn — chuột giữa dành cho dời bản đồ
    if (event.evt.button !== 0) return;
    const target = event.target;
    if (target !== target.getStage() && target.name() !== "background") return;
    if (tool === "select") return props.onSelect(null);
    const point = pointer();
    if (point) setDrag({ start: point, end: point, orthogonal: event.evt.shiftKey });
  };
  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const point = pointer();
    if (drag && point) setDrag({ ...drag, end: point, orthogonal: event.evt.shiftKey });
  };
  const onMouseUp = () => {
    if (!drag) return;
    setDrag(null);
    if (tool === "shelf" || tool === "area") {
      const drawn = boxFromDrag(drag.start, drag.end, frame);
      // Bấm một cái trên nền (không kéo đủ để vẽ) = bỏ chọn, như ở công cụ chọn
      if (drawn) props.onDraw({ kind: tool, box: drawn });
      else props.onSelect(null);
    } else if (tool === "wall" || tool === "door") {
      const line = lineFromDrag(drag.start, drag.end, frame, drag.orthogonal);
      if (line) props.onDraw({ kind: tool, line });
      else props.onSelect(null);
    }
  };
  const preview =
    drag && (tool === "wall" || tool === "door")
      ? lineFromDrag(drag.start, drag.end, frame, drag.orthogonal)
      : drag && boxFromDrag(drag.start, drag.end, frame);

  return (
    // Khung đo = cả vùng nhìn; canvas lớn hơn (zoom) thì tràn để khung cuộn ngoài kéo được, nhỏ hơn thì
    // nằm giữa (margin auto trong flex — tràn thì tự về mép đầu, không bị cắt)
    <div ref={box} className="flex h-full w-full">
      {width > 0 && (
        <Stage
          className="m-auto shrink-0"
          width={width}
          height={(frame.mapHeight + 2 * PAD) * scale}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          listening={props.interactive}
          style={{
            cursor: !props.interactive ? "inherit" : tool === "select" ? "default" : "crosshair",
          }}
        >
          <Layer ref={layer} x={PAD * scale} y={PAD * scale} scaleX={scale} scaleY={scale}>
            <GridLayer width={frame.mapWidth} height={frame.mapHeight} palette={palette} />
            {draft.items.map((item) => {
              const common = {
                frame,
                palette,
                selected: item.key === selectedKey,
                editable: props.isEditable(item),
                invalid: props.invalidKeys.has(item.key),
                onSelect: () => props.onSelect(item.key),
                onOpen: () => props.onOpen(item.key),
                onChange: (apply: (item: DraftItem) => DraftItem) =>
                  props.onChange(item.key, apply),
              };
              return item.kind === "boundary" ? (
                <BoundaryNode key={item.key} line={item} {...common} />
              ) : (
                <PlaceNode
                  key={item.key}
                  item={item}
                  zoneColor={
                    item.kind === "shelf" && item.zoneKey ? zoneColors.get(item.zoneKey) : undefined
                  }
                  bins={(item.id && binsOf.get(item.id)) || []}
                  changed={props.isChanged(item)}
                  {...common}
                />
              );
            })}
            {preview && <DrawPreview shape={preview} palette={palette} />}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
