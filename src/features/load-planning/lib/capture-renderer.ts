/**
 * Renderer WebGL dùng chung cho mọi ảnh chụp ngoài màn hình.
 *
 * Trình duyệt giới hạn số context WebGL sống (~16 ở Chromium; quá mức thì context CŨ NHẤT bị ép
 * mất). Bản gốc `capture.ts` tạo `WebGLRenderer` mới cho mỗi ảnh và chỉ gọi `dispose()` — hàm đó
 * giải phóng đối tượng GPU nhưng KHÔNG nhả context, nên mỗi lần render rò một context và tới xe thứ
 * hai thì ảnh trắng. Dùng MỘT context cho mọi ảnh giữ ta ở đúng một context dù chụp bao nhiêu xe/bước.
 * (Gốc: bản `easycargo-capture.ts` đã sửa lỗi này.)
 */

import { WebGLRenderer } from "three";

import type { BufferGeometry, Material, Scene, Texture } from "three";

let shared: WebGLRenderer | null = null;

export function acquireRenderer(width: number, height: number): WebGLRenderer {
  let renderer = shared;
  // Tạo lại nếu chưa có hoặc context đã mất (tab nền / GPU reset) — nếu không, render() vẽ không ra gì.
  if (!renderer || renderer.getContext().isContextLost()) {
    if (renderer) releaseRenderer(renderer);
    renderer = new WebGLRenderer({
      canvas: document.createElement("canvas"),
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setPixelRatio(1);
    shared = renderer;
  }
  renderer.setSize(width, height, false);
  return renderer;
}

function releaseRenderer(renderer: WebGLRenderer): void {
  try {
    renderer.forceContextLoss();
  } catch {
    // context đã mất — không còn gì để nhả
  }
  renderer.dispose();
}

/** Nhả renderer dùng chung (vd khi rời trang in). Lần chụp sau sẽ tạo lại. */
export function disposeSharedRenderer(): void {
  if (!shared) return;
  releaseRenderer(shared);
  shared = null;
}

/** Giải phóng geometry, material và texture của một cảnh để không rò GPU. */
export function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    (object as { geometry?: BufferGeometry }).geometry?.dispose();
    const materials = (object as { material?: Material | Material[] }).material;
    for (const material of Array.isArray(materials) ? materials : materials ? [materials] : []) {
      (material as Material & { map?: Texture | null }).map?.dispose();
      material.dispose();
    }
  });
}
