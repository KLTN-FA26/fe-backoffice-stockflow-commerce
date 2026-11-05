"use client";

import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";

import type { ScenePalette } from "./use-scene-palette";

/** Cạnh texture (px) — đủ nét khi camera sát kệ, nhẹ cho GPU (3 tấm × 512²). */
const SIZE = 512;
/** Bề rộng băng keo so với cạnh nắp. */
const TAPE = 0.2;

type Paint = Pick<ScenePalette, "carton" | "cartonDark" | "cartonTape" | "label" | "print">;

function canvas(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const element = document.createElement("canvas");
  element.width = SIZE;
  element.height = SIZE;
  const ctx = element.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Giấy kraft: nền + sóng gợn dọc của carton 3 lớp + viền mép đậm nhẹ. */
function kraft(ctx: CanvasRenderingContext2D, paint: Paint) {
  ctx.fillStyle = paint.carton;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = paint.cartonDark;
  ctx.globalAlpha = 0.07;
  for (let x = 0; x < SIZE; x += 6) ctx.fillRect(x, 0, 2, SIZE);
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 6;
  ctx.strokeStyle = paint.cartonDark;
  ctx.strokeRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 1;
}

/** Băng keo nâu xám hơi trong, có vệt bóng. `vertical`: dải dọc từ mép trên xuống `length`. */
function tape(ctx: CanvasRenderingContext2D, paint: Paint, vertical: boolean, length = SIZE) {
  const band = SIZE * TAPE;
  const [x, y, w, h] = vertical
    ? [(SIZE - band) / 2, 0, band, length]
    : [0, (SIZE - band) / 2, SIZE, band];
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = paint.cartonTape;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = paint.label;
  if (vertical) ctx.fillRect(x + band * 0.2, y, band * 0.12, h);
  else ctx.fillRect(x, y + band * 0.2, w, band * 0.12);
  ctx.globalAlpha = 1;
}

/** Tem vận chuyển: nền trắng, mã vạch, vài dòng chữ (vạch mảnh), góc khung đánh dấu. */
function shippingLabel(ctx: CanvasRenderingContext2D, paint: Paint) {
  const [x, y, w, h] = [SIZE * 0.36, SIZE * 0.12, SIZE * 0.5, SIZE * 0.24];
  ctx.fillStyle = paint.label;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = paint.print;
  // Mã vạch: độ rộng vạch theo dãy cố định — vẽ lại y hệt
  let bx = x + w * 0.06;
  for (let i = 0; bx < x + w * 0.56; i += 1) {
    const bar = 1 + ((i * 7) % 4);
    ctx.fillRect(bx, y + h * 0.12, bar * 1.6, h * 0.62);
    bx += bar * 1.6 + 2 + ((i * 3) % 3);
  }
  for (let line = 0; line < 4; line += 1)
    ctx.fillRect(x + w * 0.62, y + h * (0.18 + line * 0.18), w * (line % 2 ? 0.26 : 0.32), 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = paint.print;
  const c = 14;
  for (const [cx, cy, dx, dy] of [
    [x - 8, y - 8, 1, 1],
    [x + w + 8, y - 8, -1, 1],
    [x - 8, y + h + 8, 1, -1],
    [x + w + 8, y + h + 8, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * c);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * c, cy);
    ctx.stroke();
  }
}

/** Ký hiệu xếp hàng in trên thùng: hướng lên, dễ vỡ, tránh mưa + vòng tái chế. */
function handlingMarks(ctx: CanvasRenderingContext2D, paint: Paint) {
  const s = SIZE * 0.13;
  const y = SIZE * 0.72;
  ctx.strokeStyle = paint.print;
  ctx.fillStyle = paint.print;
  ctx.lineWidth = 4;
  [0.44, 0.6, 0.76].forEach((at, index) => {
    const x = SIZE * at;
    ctx.strokeRect(x, y, s, s);
    ctx.beginPath();
    if (index === 0)
      for (const ax of [x + s * 0.35, x + s * 0.65]) {
        ctx.moveTo(ax, y + s * 0.8);
        ctx.lineTo(ax, y + s * 0.25);
        ctx.moveTo(ax - s * 0.1, y + s * 0.38);
        ctx.lineTo(ax, y + s * 0.22);
        ctx.lineTo(ax + s * 0.1, y + s * 0.38);
      }
    else if (index === 1) {
      ctx.moveTo(x + s * 0.3, y + s * 0.2);
      ctx.lineTo(x + s * 0.7, y + s * 0.2);
      ctx.lineTo(x + s * 0.5, y + s * 0.52);
      ctx.closePath();
      ctx.moveTo(x + s * 0.5, y + s * 0.52);
      ctx.lineTo(x + s * 0.5, y + s * 0.8);
      ctx.moveTo(x + s * 0.36, y + s * 0.8);
      ctx.lineTo(x + s * 0.64, y + s * 0.8);
    } else {
      ctx.arc(x + s * 0.5, y + s * 0.48, s * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.moveTo(x + s * 0.5, y + s * 0.48);
      ctx.lineTo(x + s * 0.5, y + s * 0.78);
    }
    ctx.stroke();
  });
  const [rx, ry, r] = [SIZE * 0.18, SIZE * 0.8, s * 0.42];
  for (let k = 0; k < 3; k += 1) {
    const start = (k * 2 * Math.PI) / 3 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(rx, ry, r, start + 0.25, start + 1.75);
    ctx.stroke();
  }
}

/**
 * Sáu vật liệu cho hộp thùng (thứ tự mặt của `BoxGeometry`: +x, −x, +y, −y, +z, −z): hai đầu có băng
 * keo gập xuống, nắp có đường ghép mép + băng keo, hai mặt dài in tem + ký hiệu, đáy trơn. Vẽ một lần
 * bằng canvas từ token màu; màu từng thùng (instance) nhân thêm để các thùng lệch sắc nhẹ.
 */
export function cartonMaterials(paint: Paint): MeshStandardMaterial[] {
  const plain = canvas((ctx) => kraft(ctx, paint));
  const end = canvas((ctx) => {
    kraft(ctx, paint);
    tape(ctx, paint, true, SIZE * 0.28);
  });
  const top = canvas((ctx) => {
    kraft(ctx, paint);
    ctx.fillStyle = paint.cartonDark;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(0, 0, SIZE, SIZE / 2);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, SIZE / 2 - 2, SIZE, 4);
    ctx.globalAlpha = 1;
    tape(ctx, paint, false);
  });
  const side = canvas((ctx) => {
    kraft(ctx, paint);
    shippingLabel(ctx, paint);
    handlingMarks(ctx, paint);
  });
  return [end, end, top, plain, side, side].map(
    (map) => new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 }),
  );
}

/** Giải phóng texture + vật liệu khi bảng màu đổi / cảnh đóng. */
export function disposeMaterials(materials: readonly MeshStandardMaterial[]) {
  for (const texture of new Set(materials.map((material) => material.map))) texture?.dispose();
  for (const material of materials) material.dispose();
}
