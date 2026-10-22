/**
 * Dữ liệu cảnh 3D của trình soạn xếp tay — hàm thuần (không đụng three/React) để test được trong jsdom.
 *
 * Khác `prepareScene` (viewer xem): không cắt ở `renderBoxesMax` vì trình soạn vẽ mọi kiện bằng MỘT `InstancedMesh`
 * + một `LineSegments` gộp cạnh (2 lệnh vẽ cho cả xe thay vì 2 lệnh mỗi kiện), nên 600+ kiện vẫn mượt. Màu từng kiện
 * tính ở đây theo trạng thái (đang chọn, vi phạm, rê chuột).
 */

import { SCENE_COLORS } from "@/constants";

import { blockToScene } from "./scene";
import { colorOf } from "./palette";

import type { ColorMap } from "./palette";
import type { ExtentMm, LayoutBox } from "../types";
import type { SceneBlock, Vec3 } from "./scene";

export interface EditorSceneBox extends Pick<SceneBlock, "position" | "size"> {
  ref: string;
  /** Màu theo mặt hàng, trước khi tô theo trạng thái. */
  baseColor: string;
  /** Nhãn khi rê chuột. */
  label: string;
}

/** Các kiện của MỘT xe trong hệ toạ độ cảnh (gốc ở tâm xe). */
export function buildEditorBoxes(
  boxes: readonly LayoutBox[],
  extent: ExtentMm,
  scale: number,
  colors: ColorMap,
): EditorSceneBox[] {
  return boxes.map((box) => ({
    ref: box.ref,
    ...blockToScene(box, extent, scale),
    baseColor: colorOf(colors, box.partName),
    label: `${box.partName || box.label} · ${box.label}`,
  }));
}

export type BoxTone = "idle" | "hover" | "selected" | "violation";

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Trộn hai màu `#rrggbb`: `t` = 0 giữ `from`, 1 ra `to`. */
export function mixHex(from: string, to: string, t: number): string {
  const a = HEX.exec(from);
  const b = HEX.exec(to);
  if (!a || !b) return from;
  const channel = (i: number) =>
    Math.round(parseInt(a[i], 16) + (parseInt(b[i], 16) - parseInt(a[i], 16)) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(2)}${channel(3)}`;
}

const HOVER_LIGHTEN = 0.35;

/** Vi phạm ưu tiên hơn đang chọn (không để màu chọn che lỗi); rê chuột chỉ làm sáng màu gốc. */
export function toneColor(base: string, tone: BoxTone): string {
  switch (tone) {
    case "violation":
      return SCENE_COLORS.violation;
    case "selected":
      return SCENE_COLORS.selected;
    case "hover":
      return mixHex(base, "#ffffff", HOVER_LIGHTEN);
    default:
      return base;
  }
}

/** 12 cạnh của hình hộp tâm `position`, cỡ `size` → 24 đỉnh × 3 toạ độ (cặp đỉnh liên tiếp là một đoạn). */
const CORNER_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
  [4, 5],
  [5, 7],
  [7, 6],
  [6, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

export function boxEdgePositions(
  boxes: readonly Pick<EditorSceneBox, "position" | "size">[],
): Float32Array {
  const out = new Float32Array(boxes.length * CORNER_PAIRS.length * 6);
  let at = 0;
  const corner = (box: { position: Vec3; size: Vec3 }, index: number): Vec3 => [
    box.position[0] + (index & 1 ? 0.5 : -0.5) * box.size[0],
    box.position[1] + (index & 2 ? 0.5 : -0.5) * box.size[1],
    box.position[2] + (index & 4 ? 0.5 : -0.5) * box.size[2],
  ];
  for (const box of boxes) {
    for (const [from, to] of CORNER_PAIRS) {
      for (const point of [corner(box, from), corner(box, to)]) {
        out[at++] = point[0];
        out[at++] = point[1];
        out[at++] = point[2];
      }
    }
  }
  return out;
}
