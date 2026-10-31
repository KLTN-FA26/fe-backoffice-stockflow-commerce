"use client";

import { useRef } from "react";
import { Layer, Stage } from "react-konva";

import { planLevel } from "@/features/warehouse-map/selectors";

import { BoundaryNode } from "./BoundaryNode";
import { DrawPreview, MarqueeRect } from "./CanvasOverlays";
import { GridLayer } from "./GridLayer";
import { PlaceNode } from "./PlaceNode";
import { useCanvasDrag } from "./use-canvas-drag";
import { useCanvasPalette } from "./use-canvas-palette";
import { fitScale, useElementSize } from "../../shared/use-element-size";

import type Konva from "konva";
import type { DraftItem, MapDraft } from "@/features/warehouse-map/draft";
import type { DraftTool, DrawnShape } from "@/features/warehouse-map/draft-edit";
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
  /** Vùng chọn — một hình: sửa được; nhiều hình: chỉ thao tác nhóm. */
  selectedKeys: readonly string[];
  isEditable: (item: DraftItem) => boolean;
  isChanged: (item: DraftItem) => boolean;
  invalidKeys: ReadonlySet<string>;
  onSelect: (key: string | null) => void;
  /** Kéo vùng (Shift: gộp thêm). */
  onSelectMany: (keys: string[], additive: boolean) => void;
  /** Shift + bấm một hình: thêm / bớt khỏi vùng chọn. */
  onToggle: (key: string) => void;
  /** Bấm đúp một hình → mở modal thông số. */
  onOpen: (key: string) => void;
  onDraw: (shape: DrawnShape) => void;
  onChange: (key: string, apply: (item: DraftItem) => DraftItem) => void;
  /** Kéo kệ / khu vực đã lưu đang bị khoá (BR-04: còn hàng) → báo thay vì im lặng. */
  onBlockedMove: (key: string) => void;
}

/**
 * Canvas sửa bản đồ (Konva, đơn vị mét, gốc góc trên-trái như BE `Footprint`). Công cụ vẽ: kéo trên nền
 * để tạo hình nháp; công cụ chọn: bấm hình để chọn, kéo hình để dời, kéo trên nền để chọn vùng, Shift +
 * bấm để thêm / bớt. Kệ / khu vực INACTIVE không vẽ (không giữ chỗ — BR-07 — vẽ ra chỉ chồng lên hình
 * đang dùng).
 */
export default function EditorCanvas(props: EditorCanvasProps) {
  const { layout, draft, tool, selectedKeys } = props;
  const frame = layout.warehouse;
  const palette = useCanvasPalette();
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<Konva.Layer>(null);
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

  const { handlers, marquee, preview } = useCanvasDrag({
    tool,
    draft,
    frame,
    pointer: () => layer.current?.getRelativePointerPosition() ?? null,
    onSelect: props.onSelect,
    onSelectMany: props.onSelectMany,
    onDraw: props.onDraw,
  });

  return (
    // Khung đo = cả vùng nhìn; canvas lớn hơn (zoom) thì tràn để khung cuộn ngoài kéo được, nhỏ hơn thì
    // nằm giữa (margin auto trong flex — tràn thì tự về mép đầu, không bị cắt)
    <div ref={box} className="flex h-full w-full">
      {width > 0 && (
        <Stage
          className="m-auto shrink-0"
          width={width}
          height={(frame.mapHeight + 2 * PAD) * scale}
          {...handlers}
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
                selected: selectedKeys.includes(item.key),
                editable: props.isEditable(item),
                invalid: props.invalidKeys.has(item.key),
                onSelect: (additive: boolean) =>
                  additive ? props.onToggle(item.key) : props.onSelect(item.key),
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
                  onBlockedMove={item.id ? () => props.onBlockedMove(item.key) : undefined}
                  {...common}
                />
              );
            })}
            {preview && <DrawPreview shape={preview} palette={palette} />}
            {marquee && <MarqueeRect box={marquee} palette={palette} />}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
