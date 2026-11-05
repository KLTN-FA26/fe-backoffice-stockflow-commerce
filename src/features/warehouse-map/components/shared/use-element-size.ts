"use client";

import { useEffect, useState } from "react";

import type { RefObject } from "react";

/** Cỡ hiện tại của một phần tử (px) — bản đồ cần số px để tính tỉ lệ "vừa khung" (SVG / canvas Konva). */
export function useElementSize(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Tỉ lệ px / m để cả bản đồ (kèm lề `pad` m mỗi phía) nằm trọn trong khung, cả chiều ngang lẫn dọc —
 * mức zoom 1 = "vừa khung", không thanh cuộn.
 */
export function fitScale(
  box: { width: number; height: number },
  map: { width: number; height: number },
  pad: number,
): number {
  if (box.width <= 0 || box.height <= 0) return 0;
  return Math.min(box.width / (map.width + 2 * pad), box.height / (map.height + 2 * pad));
}
