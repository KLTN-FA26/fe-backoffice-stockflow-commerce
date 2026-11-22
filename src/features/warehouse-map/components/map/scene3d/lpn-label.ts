/**
 * Tem LPN dán trên thùng (kệ đang xem ở 3D): mọi tem của cảnh gom trong MỘT texture atlas + MỘT hình gộp (mỗi tem
 * một mặt phẳng, UV trỏ đúng ô của nó) → một lần vẽ. Nội dung tem: "LPN", vạch minh hoạ sinh từ mã (không dùng để
 * quét — mã đọc được là dòng chữ), mã LPN.
 */

import { CanvasTexture, PlaneGeometry, SRGBColorSpace } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { BufferGeometry } from "three";
import type { CartonPart } from "@/features/warehouse-map/cartons-3d";
import type { ScenePalette } from "./use-scene-palette";

const CELL_W = 256;
const CELL_H = 170;
/** Cạnh atlas tối đa (px) — 4096 là mức mọi GPU (kể cả máy yếu / di động) đều nạp được. */
const ATLAS_MAX = 4096;
const MAX_COLS = Math.floor(ATLAS_MAX / CELL_W);
const MAX_ROWS = Math.floor(ATLAS_MAX / CELL_H);
/** Số tem tối đa trong một atlas; thùng vượt mức dùng tem in sẵn (không có LPN riêng). */
export const LPN_LABEL_MAX = MAX_COLS * MAX_ROWS;
/** Tem 150 × 100 mm, nhỏ lại nếu mặt thùng nhỏ hơn. */
const LABEL_W = 0.15;
const LABEL_H = 0.1;

/** Số cột để atlas gần vuông (không vượt `ATLAS_MAX` khi `count ≤ LPN_LABEL_MAX`). */
function atlasGrid(count: number): { cols: number; rows: number } {
  const n = Math.max(1, count);
  const cols = Math.min(MAX_COLS, Math.max(1, Math.ceil(Math.sqrt((n * CELL_H) / CELL_W))));
  return { cols, rows: Math.ceil(n / cols) };
}

/** Băm FNV-1a của mã → dãy độ rộng vạch ổn định. */
function barWidths(code: string): number[] {
  let hash = 2166136261;
  const widths: number[] = [];
  for (let i = 0; i < 48; i += 1) {
    hash = Math.imul(hash ^ (code.charCodeAt(i % code.length) + i), 16777619);
    widths.push(1 + ((hash >>> 0) % 4));
  }
  return widths;
}

export function lpnAtlas(
  lpns: readonly string[],
  paint: Pick<ScenePalette, "label" | "print">,
): CanvasTexture {
  const { cols, rows } = atlasGrid(lpns.length);
  const element = document.createElement("canvas");
  element.width = cols * CELL_W;
  element.height = rows * CELL_H;
  const ctx = element.getContext("2d");
  lpns.forEach((lpn, i) => {
    if (!ctx) return;
    const [x, y] = [(i % cols) * CELL_W, Math.floor(i / cols) * CELL_H];
    ctx.fillStyle = paint.label;
    ctx.fillRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8);
    ctx.strokeStyle = paint.print;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, y + 10, CELL_W - 20, CELL_H - 20);
    ctx.fillStyle = paint.print;
    ctx.textBaseline = "top";
    ctx.font = "700 24px Inter, system-ui, sans-serif";
    ctx.fillText("LPN", x + 20, y + 18);
    ctx.fillRect(x + 18, y + 48, CELL_W - 36, 2);
    let bx = x + 22;
    barWidths(lpn).forEach((width, k) => {
      if (bx + width > x + CELL_W - 22) return;
      if (k % 2 === 0) ctx.fillRect(bx, y + 58, width * 1.4, 62);
      bx += width * 1.4 + 1;
    });
    ctx.font = "500 19px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(lpn, x + 22, y + 130, CELL_W - 44);
  });
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Mặt phẳng tem trên mặt +z cục bộ (mặt in tem, quay ra lối lấy hàng) của từng thùng — UV theo ô atlas. */
export function lpnLabelGeometry(cartons: readonly CartonPart[]): BufferGeometry | null {
  const { cols, rows } = atlasGrid(cartons.length);
  const planes = cartons.map((part, i) => {
    const [w, h, d] = part.size;
    // Co đều hai cạnh để giữ tỉ lệ tem như ô atlas
    const scale = Math.min(1, (w * 0.7) / LABEL_W, (h * 0.55) / LABEL_H);
    const [lw, lh] = [LABEL_W * scale, LABEL_H * scale];
    const plane = new PlaneGeometry(lw, lh);
    const uv = plane.attributes.uv;
    const [col, row] = [i % cols, Math.floor(i / cols)];
    if (uv)
      for (let k = 0; k < uv.count; k += 1)
        uv.setXY(k, (col + uv.getX(k)) / cols, 1 - (row + 1 - uv.getY(k)) / rows);
    // Dán lệch phải một chút như dán tay, sát mặt thùng (tránh z-fighting bằng khe 3 mm)
    plane.translate(w * 0.12, h * 0.05, d / 2 + 0.003);
    plane.rotateY(part.yaw);
    plane.translate(...part.position);
    return plane;
  });
  return planes.length > 0 ? mergeGeometries(planes) : null;
}
