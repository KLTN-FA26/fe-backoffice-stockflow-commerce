"use client";

import { useState } from "react";

import { boxFromDrag, lineFromDrag } from "@/features/warehouse-map/draft-geometry";
import { keysInBox } from "@/features/warehouse-map/draft-group";

import type { KonvaEventObject } from "konva/lib/Node";
import type { MapDraft } from "@/features/warehouse-map/draft";
import type { DraftTool, DrawnShape } from "@/features/warehouse-map/draft-edit";
import type { MapPoint } from "@/features/warehouse-map/draft-geometry";
import type { MapBox } from "@/features/warehouse-map/selectors";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/** Kéo ngắn hơn ngần này (m) coi như một cú bấm. */
const CLICK = 0.2;

interface Drag {
  start: MapPoint;
  end: MapPoint;
  /** Giữ Shift: vẽ tường / cửa thẳng ngang dọc; chọn vùng thì gộp thêm vào vùng chọn. */
  shift: boolean;
}

/** Hộp theo hai góc kéo — không bám lưới (chọn vùng không tạo hình). */
const rawBox = (a: MapPoint, b: MapPoint): MapBox => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});

/**
 * Kéo trên NỀN canvas: công cụ vẽ → hình nháp (bám lưới); công cụ chọn → khung chọn vùng, thả chuột
 * chọn mọi hình chạm khung (Shift: gộp thêm). Bấm nền không kéo = bỏ chọn.
 */
export function useCanvasDrag({
  tool,
  draft,
  frame,
  pointer,
  onSelect,
  onSelectMany,
  onDraw,
}: {
  tool: DraftTool;
  draft: MapDraft;
  frame: WarehouseLayout["warehouse"];
  pointer: () => MapPoint | null;
  onSelect: (key: string | null) => void;
  onSelectMany: (keys: string[], additive: boolean) => void;
  onDraw: (shape: DrawnShape) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);

  const onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    // Chỉ chuột trái vẽ / chọn — chuột giữa dành cho dời bản đồ
    if (event.evt.button !== 0 || tool === "pan") return;
    const target = event.target;
    if (target !== target.getStage() && target.name() !== "background") return;
    const point = pointer();
    if (point) setDrag({ start: point, end: point, shift: event.evt.shiftKey });
  };
  const onMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    const point = pointer();
    if (drag && point) setDrag({ ...drag, end: point, shift: event.evt.shiftKey });
  };
  const onMouseUp = () => {
    if (!drag) return;
    setDrag(null);
    const box = rawBox(drag.start, drag.end);
    const clicked = box.w < CLICK && box.h < CLICK;
    if (tool === "select") {
      if (!clicked) onSelectMany(keysInBox(draft, box), drag.shift);
      else if (!drag.shift) onSelect(null);
    } else if (tool === "shelf" || tool === "area") {
      const drawn = boxFromDrag(drag.start, drag.end, frame);
      // Bấm một cái trên nền (không kéo đủ để vẽ) = bỏ chọn, như ở công cụ chọn
      if (drawn) onDraw({ kind: tool, box: drawn });
      else onSelect(null);
    } else if (tool === "wall" || tool === "door") {
      const line = lineFromDrag(drag.start, drag.end, frame, drag.shift);
      if (line) onDraw({ kind: tool, line });
      else onSelect(null);
    }
  };

  const marquee = drag && tool === "select" ? rawBox(drag.start, drag.end) : null;
  const preview =
    drag && (tool === "wall" || tool === "door")
      ? lineFromDrag(drag.start, drag.end, frame, drag.shift)
      : drag && (tool === "shelf" || tool === "area")
        ? boxFromDrag(drag.start, drag.end, frame)
        : null;
  return {
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
    marquee,
    preview,
  };
}
