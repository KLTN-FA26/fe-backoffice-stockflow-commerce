import { movedFootprint } from "@/features/warehouse-map/draft-geometry";
import { boxOf } from "@/features/warehouse-map/selectors";

import type { KonvaEventObject } from "konva/lib/Node";
import type { DraftItem, DraftPlace } from "@/features/warehouse-map/draft";
import type { MapFrame } from "@/features/warehouse-map/draft-geometry";
import type { Footprint } from "@/features/warehouse-map/types";

export const withFootprint = (footprint: Footprint) => (item: DraftItem) =>
  item.kind === "boundary" ? item : { ...item, footprint };

type PlaceDragEvent = KonvaEventObject<DragEvent>;

/**
 * Kéo để dời kệ / khu vực: bám lưới, không ra khỏi khung (BR-06). Hình bị khoá (BR-04: còn hàng) vẫn
 * "kéo được" để bắt lúc bắt đầu kéo — dừng ngay, trả về chỗ cũ và báo lý do thay vì im lặng.
 */
export function placeDragHandlers({
  item,
  frame,
  editable,
  onChange,
  onBlockedMove,
}: {
  item: DraftPlace;
  frame: MapFrame;
  editable: boolean;
  onChange: (apply: (item: DraftItem) => DraftItem) => void;
  onBlockedMove?: () => void;
}) {
  const moved = (event: PlaceDragEvent) =>
    movedFootprint(item.footprint, event.target.position(), frame);
  return {
    draggable: editable || onBlockedMove !== undefined,
    onDragStart: (event: PlaceDragEvent) => {
      if (editable) return;
      const box = boxOf(item.footprint);
      event.target.stopDrag();
      event.target.position({ x: box.x, y: box.y });
      onBlockedMove?.();
    },
    onDragMove: (event: PlaceDragEvent) => {
      const next = boxOf(moved(event));
      event.target.position({ x: next.x, y: next.y });
    },
    onDragEnd: (event: PlaceDragEvent) => onChange(withFootprint(moved(event))),
  };
}
