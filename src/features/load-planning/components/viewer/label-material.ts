/**
 * Vật liệu nhãn dạng billboard dựng từ canvas 2D — không tải font ngoài (khác drei `<Text>`/troika),
 * nên không bao giờ làm sập canvas WebGL khi offline. (Gốc: `makeLabelMaterial`.)
 */

import { CanvasTexture, SpriteMaterial } from "three";

import { SCENE_COLORS } from "@/constants";

import { truncateLabel } from "../../lib/scene";

const WIDTH = 256;
const HEIGHT = 128;

export function makeLabelMaterial(text: string): SpriteMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(8, 42, 240, 44);
    ctx.fillStyle = SCENE_COLORS.labelText;
    ctx.font = "bold 54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(truncateLabel(text), WIDTH / 2, 65);
  }
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

/** Giải phóng texture + material của các nhãn (không tự nhả khi unmount vì tạo ngoài JSX). */
export function disposeLabelMaterials(materials: Iterable<SpriteMaterial>): void {
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}
