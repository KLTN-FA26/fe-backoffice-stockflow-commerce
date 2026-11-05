/**
 * Dựng dữ liệu cảnh 3D từ `Layout` — hàm thuần, không đụng three/React nên test được trong jsdom.
 * (Gốc: `prepareNesting3DScene` trong `nesting-3d-viewer.tsx`.)
 *
 * Cảnh co về cạnh dài nhất = 10 đơn vị thế giới. Gốc cảnh đặt ở TÂM xe; toạ độ mm (gốc ở góc sàn)
 * được dời về tâm: x → ngang, y → lên, z → dọc xe (về phía cửa).
 */

import { LOAD_PLANNING_LABELS, LOAD_PLANNING_LIMITS } from "@/constants";

import { extentOf, formatLWH } from "./dims";
import { buildColorMap, colorOf } from "./palette";

import type { ColorMap } from "./palette";
import type { BlockMm, ExtentMm, Layout, LayoutBox } from "../types";

export type Vec3 = [number, number, number];

const WORLD_SPAN = 10;
const MIN_SIZE = 0.01;
const MAX_LABEL_CHARS = 14;
/** Camera đặt cách tâm cảnh bằng chừng này lần cạnh dài nhất (gốc 1.35). */
const CAMERA_FIT = 1.35;

export interface SceneBlock {
  id: string;
  position: Vec3;
  size: Vec3;
  label?: string;
}

export interface SceneBox extends SceneBlock {
  box: LayoutBox;
  color: string;
  /** Nhãn hiện khi rê chuột: tên + kích thước ĐÃ XOAY theo D×R×C. */
  label: string;
  /** Mã ngắn in trên mặt kiện. */
  code: string;
}

export interface SceneData {
  boxes: SceneBox[];
  gussets: SceneBlock[];
  extent: ExtentMm;
  /** Kích thước xe trong đơn vị thế giới. */
  width: number;
  height: number;
  depth: number;
  scale: number;
  cameraDistance: number;
  /** Có kiện bị bỏ vì vượt giới hạn dựng; null nếu dựng đủ. */
  truncated: { shown: number; total: number } | null;
}

export function sceneScale(extent: ExtentMm): number {
  const longest = Math.max(extent.wMm, extent.hMm, extent.dMm);
  return longest > 0 ? WORLD_SPAN / longest : 1;
}

/** Cắt chuỗi quá dài để nhãn không tràn mặt thùng. */
export function truncateLabel(text: string): string {
  return text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…` : text;
}

/** Hộp mm (gốc ở góc sàn) → vị trí tâm + kích thước trong cảnh. `shrink` < 1 chừa khe giữa các khối kề nhau. */
export function blockToScene(
  block: BlockMm,
  extent: ExtentMm,
  scale: number,
  shrink = 1,
): Pick<SceneBlock, "position" | "size"> {
  return {
    position: [
      (block.xMm + block.wMm / 2 - extent.wMm / 2) * scale,
      (block.yMm + block.hMm / 2 - extent.hMm / 2) * scale,
      (block.zMm + block.dMm / 2 - extent.dMm / 2) * scale,
    ],
    size: [
      Math.max(block.wMm * scale * shrink, MIN_SIZE),
      Math.max(block.hMm * scale * shrink, MIN_SIZE),
      Math.max(block.dMm * scale * shrink, MIN_SIZE),
    ],
  };
}

/** Nhãn khi rê chuột: tên + KÍCH THƯỚC ĐÃ XOAY — cùng SKU xếp hai kiểu sẽ ra hai chuỗi khác nhau. */
export function hoverLabel(box: LayoutBox): string {
  return `${box.partName || box.label || LOAD_PLANNING_LABELS.unnamed} · ${formatLWH(box)}`;
}

export function faceCode(box: LayoutBox): string {
  return truncateLabel((box.label || box.partName).trim());
}

export function prepareScene(layout: Layout, colorMap?: ColorMap): SceneData {
  const extent = extentOf(layout.innerMm);
  const scale = sceneScale(extent);
  // Ưu tiên bảng màu của người gọi (chú giải bên cạnh) để 3D và chú giải luôn khớp.
  const colors = colorMap ?? buildColorMap(layout.boxes.map((b) => b.partName));
  const shown = layout.boxes.slice(0, LOAD_PLANNING_LIMITS.renderBoxesMax);
  const boxes = shown.map((box, index): SceneBox => ({
    ...blockToScene(box, extent, scale),
    id: `${index}-${box.ref}`,
    box,
    color: colorOf(colors, box.partName),
    label: hoverLabel(box),
    code: faceCode(box),
  }));
  const gussets = layout.gussets.map((g, index): SceneBlock => ({
    id: `gusset-${index}`,
    ...blockToScene(g, extent, scale),
  }));
  const width = extent.wMm * scale;
  const height = extent.hMm * scale;
  const depth = extent.dMm * scale;
  return {
    boxes,
    gussets,
    extent,
    width,
    height,
    depth,
    scale,
    cameraDistance: Math.max(width, height, depth) * CAMERA_FIT,
    truncated:
      layout.boxes.length > shown.length
        ? { shown: shown.length, total: layout.boxes.length }
        : null,
  };
}
