"use client";

import { LINE } from "./shape-utils";

import type { PlaceMark } from "@/features/warehouse-map/location-pick";

/** Lề khung đánh dấu quanh kệ / khu (m) — ngoài khung "đang chọn" của chính hình đó. */
const GAP = 0.45;

const frame = (mark: PlaceMark) => ({
  x: mark.box.x - GAP,
  y: mark.box.y - GAP,
  width: mark.box.w + GAP * 2,
  height: mark.box.h + GAP * 2,
  rx: 0.4,
});

/**
 * Đánh dấu trên mặt bằng 2D khi chọn vị trí (docs 11 §4.1): viền đứt cam = nơi các thùng đang nằm, viền liền xanh lá
 * + nền nhạt = vị trí đích đã chọn. Không nhận chuột — bấm kệ / khu bên dưới vẫn được.
 */
export function PickOverlay({
  marked,
  picked,
}: {
  marked: readonly PlaceMark[];
  picked: readonly PlaceMark[];
}) {
  return (
    <g className="pointer-events-none" aria-hidden>
      {marked.map((mark) => (
        <rect
          key={`marked-${mark.id}`}
          {...frame(mark)}
          className="stroke-dot-warning fill-none"
          strokeWidth={LINE.bold}
          strokeDasharray="0.6 0.35"
        />
      ))}
      {picked.map((mark) => (
        <rect
          key={`picked-${mark.id}`}
          {...frame(mark)}
          className="stroke-dot-positive fill-dot-positive"
          fillOpacity={0.12}
          strokeWidth={LINE.bold}
        />
      ))}
    </g>
  );
}
