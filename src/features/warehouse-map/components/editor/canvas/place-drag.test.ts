import { describe, expect, it, vi } from "vitest";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";
import { draftFromLayout } from "@/features/warehouse-map/draft";
import { boxOf } from "@/features/warehouse-map/selectors";

import { placeDragHandlers } from "./place-drag";

import type { KonvaEventObject } from "konva/lib/Node";
import type { DraftItem, DraftPlace } from "@/features/warehouse-map/draft";

const shelf = draftFromLayout(LAYOUT).items.find((item) => item.key === "shelf-a01");
if (!shelf || shelf.kind === "boundary") throw new Error("thiếu kệ A01");
const place: DraftPlace = shelf;
const frame = LAYOUT.warehouse;

/** Node Konva giả — handler chỉ dùng `position()` và `stopDrag()`. */
function fakeDrag(start: { x: number; y: number }) {
  let pos = start;
  const target = {
    position: (next?: { x: number; y: number }) => {
      if (next) pos = next;
      return pos;
    },
    stopDrag: vi.fn(),
  };
  // jsdom không có canvas để dựng Node Konva thật; handler chỉ đọc 2 hàm trên của `target`
  const event = { target } as unknown as KonvaEventObject<DragEvent>;
  return { event, target, at: () => pos };
}

const handlersFor = (editable: boolean, onBlockedMove?: () => void) => {
  const onChange = vi.fn<(apply: (item: DraftItem) => DraftItem) => void>();
  return {
    onChange,
    ...placeDragHandlers({ item: place, frame, editable, onChange, onBlockedMove }),
  };
};

describe("kéo kệ / khu vực trên canvas sửa", () => {
  it("BR-04: kệ bị khoá — bắt đầu kéo thì dừng, trả về chỗ cũ, báo lý do; KHÔNG ghi footprint", () => {
    const onBlockedMove = vi.fn();
    const drag = handlersFor(false, onBlockedMove);
    const box = boxOf(place.footprint);
    // Lệch lưới: bản đã bám lưới của vị trí này khác toạ độ đang lưu
    const { event, target, at } = fakeDrag({ x: box.x + 3.3, y: box.y + 1.2 });
    expect(drag.draggable).toBe(true);
    drag.onDragStart(event);
    expect(target.stopDrag).toHaveBeenCalledTimes(1);
    expect(at()).toEqual({ x: box.x, y: box.y });
    expect(onBlockedMove).toHaveBeenCalledTimes(1);
    // `stopDrag()` phát `dragend` (và có thể `dragmove`) ngay sau đó
    drag.onDragMove(event);
    drag.onDragEnd(event);
    expect(drag.onChange).not.toHaveBeenCalled();
    expect(at()).toEqual({ x: box.x, y: box.y });
  });

  it("hình bị khoá mà không cần báo (vd hình mới không có id) → không kéo được", () => {
    expect(handlersFor(false).draggable).toBe(false);
  });

  it("hình sửa được → thả chuột ghi footprint đã bám lưới vào bản nháp", () => {
    const drag = handlersFor(true);
    const box = boxOf(place.footprint);
    const { event } = fakeDrag({ x: box.x + 2, y: box.y });
    drag.onDragStart(event);
    drag.onDragEnd(event);
    expect(drag.onChange).toHaveBeenCalledTimes(1);
    const apply = drag.onChange.mock.calls[0]?.[0];
    const moved = apply?.(place);
    expect(moved?.kind !== "boundary" && moved?.footprint).toMatchObject({
      x: place.footprint.x + 2,
    });
  });
});
