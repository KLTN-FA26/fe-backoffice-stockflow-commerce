"use client";

import { useEffect, useRef } from "react";
import { Group, Rect, Transformer } from "react-konva";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { footprintFromBox, snap } from "@/features/warehouse-map/draft-geometry";
import { boxOf, shelfTransform } from "@/features/warehouse-map/selectors";

import { LINE } from "../../map/shape-utils";
import { placeDragHandlers, withFootprint } from "./place-drag";
import { PlaceLabel } from "./PlaceLabel";
import { ShelfDetail } from "./ShelfDetail";

import type Konva from "konva";
import type { DraftItem, DraftPlace } from "@/features/warehouse-map/draft";
import type { MapFrame } from "@/features/warehouse-map/draft-geometry";
import type { Footprint } from "@/features/warehouse-map/types";
import type { CanvasPalette } from "./use-canvas-palette";

export interface PlaceNodeProps {
  item: DraftPlace;
  frame: MapFrame;
  palette: CanvasPalette;
  zoneColor?: string;
  /** Ô bin của kệ đã lưu (tầng thấp nhất, khung cục bộ). */
  bins: readonly Footprint[];
  selected: boolean;
  /** Kéo / đổi cỡ được: hình mới, hoặc hình đã lưu không còn hàng và có quyền sửa. */
  editable: boolean;
  invalid: boolean;
  changed: boolean;
  /** `additive`: Shift + bấm — thêm / bớt khỏi vùng chọn. */
  onSelect: (additive: boolean) => void;
  onOpen: () => void;
  onChange: (apply: (item: DraftItem) => DraftItem) => void;
  /** Hình đã lưu: thử kéo khi đang bị khoá (còn hàng, đang kiểm tồn, thiếu quyền) → báo lý do. */
  onBlockedMove?: () => void;
}

/**
 * Kệ / khu vực trên canvas sửa: kéo để dời (bám lưới 0,5 m, không ra khỏi khung — BR-06), kéo góc để
 * đổi cỡ (không xoay ở đây; xoay bằng R / bảng thông số — BR-09). Viền đỏ = đang vi phạm luật.
 */
export function PlaceNode(props: PlaceNodeProps) {
  const { item, frame, palette, selected, editable, invalid, changed, onChange, onBlockedMove } =
    props;
  const group = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const box = boxOf(item.footprint);
  const { tx, ty, deg } = shelfTransform(item.footprint);
  const shelf = item.kind === "shelf";

  useEffect(() => {
    if (!transformer.current) return;
    transformer.current.nodes(selected && editable && group.current ? [group.current] : []);
    transformer.current.getLayer()?.batchDraw();
  }, [selected, editable]);

  const stroke = invalid
    ? palette.danger
    : selected
      ? palette.info
      : changed
        ? palette.warning
        : palette.inkSoft;
  const fill = shelf ? (props.zoneColor ?? palette.muted) : palette.subtle;

  return (
    <>
      <Group
        ref={group}
        x={box.x}
        y={box.y}
        {...placeDragHandlers({ item, frame, editable, onChange, onBlockedMove })}
        onMouseDown={(event) => props.onSelect(event.evt.shiftKey)}
        onTap={() => props.onSelect(false)}
        onDblClick={props.onOpen}
        onDblTap={props.onOpen}
        onTransformEnd={() => {
          const node = group.current;
          if (!node) return;
          const [sx, sy] = [node.scaleX(), node.scaleY()];
          node.scale({ x: 1, y: 1 });
          const next = {
            x: Math.max(0, snap(node.x())),
            y: Math.max(0, snap(node.y())),
            w: Math.max(LIMITS.minDrawSize, snap(box.w * sx)),
            h: Math.max(LIMITS.minDrawSize, snap(box.h * sy)),
          };
          onChange(withFootprint(footprintFromBox(next, item.footprint.rotation)));
        }}
      >
        <Rect
          width={box.w}
          height={box.h}
          fill={fill}
          opacity={shelf && props.zoneColor ? 0.35 : 1}
          strokeEnabled={false}
        />
        {shelf && (
          <Group x={tx - box.x} y={ty - box.y} rotation={deg} listening={false}>
            <ShelfDetail shelf={item} bins={props.bins} stroke={stroke} grid={palette.inkSoft} />
          </Group>
        )}
        <Rect
          width={box.w}
          height={box.h}
          stroke={stroke}
          strokeWidth={selected || invalid ? LINE.bold : LINE.base}
          dash={shelf ? (changed ? [0.4, 0.25] : undefined) : [0.6, 0.35]}
          listening={false}
        />
        <PlaceLabel item={item} width={box.w} height={box.h} palette={palette} />
      </Group>
      {selected && editable && (
        <Transformer
          ref={transformer}
          rotateEnabled={false}
          flipEnabled={false}
          keepRatio={false}
          ignoreStroke
          borderStroke={palette.info}
          anchorStroke={palette.info}
          anchorFill={palette.surface}
          anchorSize={9}
          boundBoxFunc={(oldBox, newBox) => {
            const scale = group.current?.getLayer()?.getAbsoluteScale().x ?? 1;
            const min = LIMITS.minDrawSize * scale;
            return newBox.width < min || newBox.height < min ? oldBox : newBox;
          }}
        />
      )}
    </>
  );
}
