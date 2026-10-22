/**
 * Dựng cảnh three.js THUẦN (không react-three-fiber) cho ảnh chụp ngoài màn hình, để tạo ảnh đồng bộ,
 * theo yêu cầu, không cần mount canvas React. Không vẽ khối gia cố (ảnh in coi góc đó là chỗ trống).
 */

import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
} from "three";

import { SCENE_COLORS } from "@/constants";

import { extentOf } from "./dims";
import { sceneScale } from "./scene";

import type { ExtentMm, Layout, LayoutBox } from "../types";

export type ColorOf = (box: LayoutBox) => string;
export type LabelOf = (box: LayoutBox) => string;

const MIN_SIZE = 0.01;
/** Không vẽ nhãn lên thùng nhỏ hơn mức này (đơn vị thế giới) vì không đọc được. */
const MIN_LABEL_FOOTPRINT = 0.4;

/** Nhãn luôn quay về camera, đọc được ở mọi góc. */
function makeLabelSprite(text: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(8, 40, 240, 48);
    ctx.fillStyle = SCENE_COLORS.labelText;
    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 65);
  }
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
}

export interface CaptureScene {
  scene: Scene;
  /** Cạnh dài nhất của xe trong đơn vị thế giới. */
  span: number;
  extent: ExtentMm;
  scale: number;
}

export function buildCaptureScene(
  layout: Layout,
  boxes: readonly LayoutBox[],
  colorOf: ColorOf,
  labelOf?: LabelOf,
): CaptureScene {
  const extent = extentOf(layout.innerMm);
  const scale = sceneScale(extent);
  const scene = new Scene();
  scene.background = new Color(SCENE_COLORS.captureBackground);

  const shellGeometry = new BoxGeometry(extent.wMm * scale, extent.hMm * scale, extent.dMm * scale);
  scene.add(
    new LineSegments(
      new EdgesGeometry(shellGeometry),
      new LineBasicMaterial({ color: SCENE_COLORS.captureShellEdge }),
    ),
  );
  shellGeometry.dispose();

  const edgeMaterial = new LineBasicMaterial({ color: SCENE_COLORS.captureBoxEdge });
  for (const box of boxes) {
    const width = Math.max(box.wMm * scale, MIN_SIZE);
    const height = Math.max(box.hMm * scale, MIN_SIZE);
    const depth = Math.max(box.dMm * scale, MIN_SIZE);
    const geometry = new BoxGeometry(width, height, depth);
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({ color: colorOf(box), roughness: 0.6, metalness: 0.05 }),
    );
    mesh.position.set(
      (box.xMm + box.wMm / 2 - extent.wMm / 2) * scale,
      (box.yMm + box.hMm / 2 - extent.hMm / 2) * scale,
      (box.zMm + box.dMm / 2 - extent.dMm / 2) * scale,
    );
    scene.add(mesh);
    const edges = new LineSegments(new EdgesGeometry(geometry), edgeMaterial);
    edges.position.copy(mesh.position);
    scene.add(edges);

    const text = labelOf?.(box);
    if (text && Math.min(width, depth) > MIN_LABEL_FOOTPRINT) {
      const sprite = makeLabelSprite(text);
      const labelWidth = Math.min(Math.min(width, depth) * 0.9, 1.4);
      sprite.scale.set(labelWidth, labelWidth * 0.5, 1);
      sprite.position.set(
        mesh.position.x,
        mesh.position.y + height / 2 + labelWidth * 0.28,
        mesh.position.z,
      );
      scene.add(sprite);
    }
  }

  scene.add(new AmbientLight(0xffffff, 0.75));
  const key = new DirectionalLight(0xffffff, 1.0);
  key.position.set(8, 12, 6);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.35);
  fill.position.set(-8, 4, -6);
  scene.add(fill);

  return { scene, span: Math.max(extent.wMm, extent.hMm, extent.dMm) * scale, extent, scale };
}
