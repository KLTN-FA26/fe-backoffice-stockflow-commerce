/**
 * Hình học của chế độ sửa bản đồ — kéo / vẽ / đổi cỡ trên canvas đổi ra số đo mét cho bản nháp.
 * Thuần, không side effect. Quy ước như BE `Footprint`: (x, y) là góc trên-trái SAU khi xoay; quay
 * 90 / 270 đổi chỗ hai cạnh (docs 06 §5, BR-09).
 */

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { boxOf } from "./selectors";

import type { MapLine } from "./draft-edit";
import type { MapBox } from "./selectors";
import type { Footprint } from "./types";

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapFrame {
  mapWidth: number;
  mapHeight: number;
}

/** Làm tròn tới milimét — BE nhận tối đa 3 số lẻ và không tự làm tròn (docs 06 §3). */
export const toMm = (value: number): number => Math.round(value * 1000) / 1000;

export const snap = (value: number, step: number = LIMITS.snapStep): number =>
  toMm(Math.round(value / step) * step);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const clampPoint = (point: MapPoint, frame: MapFrame): MapPoint => ({
  x: clamp(point.x, 0, frame.mapWidth),
  y: clamp(point.y, 0, frame.mapHeight),
});

/** Hộp kéo từ điểm đầu tới điểm cuối (đã bám lưới, kẹp trong khung); quá nhỏ → `null` = bấm nhầm. */
export function boxFromDrag(start: MapPoint, end: MapPoint, frame: MapFrame): MapBox | null {
  const a = clampPoint({ x: snap(start.x), y: snap(start.y) }, frame);
  const b = clampPoint({ x: snap(end.x), y: snap(end.y) }, frame);
  const box = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: toMm(Math.abs(a.x - b.x)),
    h: toMm(Math.abs(a.y - b.y)),
  };
  return box.w < LIMITS.minDrawSize || box.h < LIMITS.minDrawSize ? null : box;
}

/** Đoạn tường / cửa; `orthogonal` (giữ Shift) ép nằm ngang hoặc dọc theo trục dài hơn. */
export function lineFromDrag(
  start: MapPoint,
  end: MapPoint,
  frame: MapFrame,
  orthogonal: boolean,
): MapLine | null {
  const a = clampPoint({ x: snap(start.x), y: snap(start.y) }, frame);
  let b = clampPoint({ x: snap(end.x), y: snap(end.y) }, frame);
  if (orthogonal)
    b = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  if (Math.hypot(b.x - a.x, b.y - a.y) < LIMITS.minDrawSize) return null;
  return { startX: a.x, startY: a.y, endX: b.x, endY: b.y };
}

/** Hộp trên mặt bằng → footprint giữ nguyên góc xoay (90 / 270: cạnh x là `length`). */
export function footprintFromBox(box: MapBox, rotation: number): Footprint {
  const turned = rotation === 90 || rotation === 270;
  return {
    x: toMm(box.x),
    y: toMm(box.y),
    width: toMm(turned ? box.h : box.w),
    length: toMm(turned ? box.w : box.h),
    rotation,
  };
}

/** Dời hộp tới (x, y) đã bám lưới, không ra khỏi khung (BR-06). */
export function movedFootprint(footprint: Footprint, to: MapPoint, frame: MapFrame): Footprint {
  const box = boxOf(footprint);
  return footprintFromBox(
    {
      ...box,
      x: clamp(snap(to.x), 0, Math.max(0, frame.mapWidth - box.w)),
      y: clamp(snap(to.y), 0, Math.max(0, frame.mapHeight - box.h)),
    },
    footprint.rotation,
  );
}

/** Dời tinh bằng phím mũi tên (0,1 m, Shift 1 m) — không bám lưới để chỉnh lẻ được. */
export function nudgedFootprint(footprint: Footprint, dx: number, dy: number, frame: MapFrame) {
  const box = boxOf(footprint);
  return footprintFromBox(
    {
      ...box,
      x: clamp(toMm(box.x + dx), 0, Math.max(0, frame.mapWidth - box.w)),
      y: clamp(toMm(box.y + dy), 0, Math.max(0, frame.mapHeight - box.h)),
    },
    footprint.rotation,
  );
}

/** Xoay 90° theo chiều kim đồng hồ quanh góc trên-trái (BR-09: chỉ 0 / 90 / 180 / 270). */
export function rotatedFootprint(footprint: Footprint): Footprint {
  const rotation = (footprint.rotation + 90) % 360;
  return { ...footprint, rotation };
}

export const nudgedLine = (line: MapLine, dx: number, dy: number): MapLine => ({
  startX: toMm(line.startX + dx),
  startY: toMm(line.startY + dy),
  endX: toMm(line.endX + dx),
  endY: toMm(line.endY + dy),
});
