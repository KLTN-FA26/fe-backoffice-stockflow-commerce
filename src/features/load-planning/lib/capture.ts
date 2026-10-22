/**
 * Chụp ảnh 3D xe ngoài màn hình thành data URL JPEG — cho trang in kế hoạch xếp (PR F6) và hình
 * xem trước từng bước. Dùng three thuần + MỘT renderer dùng chung (xem `capture-renderer.ts`).
 *
 * Bỏ phần xuất PDF của bản gốc (`easycargo-pdf.ts`, jsPDF): trang in sẽ là HTML.
 */

import { PerspectiveCamera, Vector3 } from "three";

import { fitDistance, toJpeg, trimWhite } from "./capture-fit";
import { acquireRenderer, disposeScene } from "./capture-renderer";
import { buildCaptureScene } from "./capture-scene";

import type { CapturedView } from "./capture-fit";
import type { ColorOf, LabelOf } from "./capture-scene";
import type { Layout, LayoutBox } from "../types";

export type { CapturedView } from "./capture-fit";
export type { ColorOf, LabelOf } from "./capture-scene";

const VIEW_WIDTH = 1800;
const VIEW_HEIGHT = 1120;
const STEP_WIDTH = 1200;
const STEP_HEIGHT = 760;
const FOV = 34;
/** Aspect (cao/rộng) ảnh từng bước, cho bố cục in. */
export const STEP_ASPECT = STEP_HEIGHT / STEP_WIDTH;
/** Chừa khoảng phía trên mái để nhãn nổi trên thùng không bị cắt. */
const ROOF_HEADROOM = 0.9;
const VIEW_ELEVATION = 0.72;

/**
 * Chụp xe từ hai góc đối diện (TRÁI/PHẢI), camera căn khít vào hàng và viền trắng đã cắt.
 * Ném lỗi nếu WebGL không dùng được.
 */
export function captureVehicleViews(
  layout: Layout,
  colorOf: ColorOf,
  labelOf?: LabelOf,
): { left: CapturedView; right: CapturedView } {
  const renderer = acquireRenderer(VIEW_WIDTH, VIEW_HEIGHT);
  const { scene, extent, scale } = buildCaptureScene(layout, layout.boxes, colorOf, labelOf);
  const camera = new PerspectiveCamera(FOV, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 1000);

  const halfX = (extent.wMm * scale) / 2;
  const halfZ = (extent.dMm * scale) / 2;
  const yTop = (extent.hMm * scale) / 2 + ROOF_HEADROOM;
  const yBottom = -(extent.hMm * scale) / 2;
  const corners: Vector3[] = [];
  for (const x of [-halfX, halfX]) {
    for (const y of [yBottom, yTop]) {
      for (const z of [-halfZ, halfZ]) corners.push(new Vector3(x, y, z));
    }
  }

  const renderFrom = (dx: number, dz: number): CapturedView => {
    const direction = new Vector3(dx, VIEW_ELEVATION, dz).normalize();
    camera.position.copy(direction).multiplyScalar(fitDistance(camera, direction, corners));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return trimWhite(renderer.domElement);
  };

  try {
    // TRÁI: góc phía đầu xe; PHẢI: quay 180° sang phía đối diện.
    return { left: renderFrom(0.95, 1.3), right: renderFrom(-0.95, -1.3) };
  } finally {
    disposeScene(scene);
  }
}

/**
 * Một ảnh CỘNG DỒN cho mỗi bước xếp: xe chứa mọi kiện tới hết bước đó (một góc chéo). `stepBoxes[k]`
 * là khối được xếp ở bước k. Dùng chung renderer cho mọi bước.
 */
export function captureStepImages(
  layout: Layout,
  stepBoxes: readonly (readonly LayoutBox[])[],
  colorOf: ColorOf,
  labelOf?: LabelOf,
): string[] {
  if (stepBoxes.length === 0) return [];
  const renderer = acquireRenderer(STEP_WIDTH, STEP_HEIGHT);
  const camera = new PerspectiveCamera(FOV, STEP_WIDTH / STEP_HEIGHT, 0.1, 1000);
  const loaded: LayoutBox[] = [];
  const images: string[] = [];
  for (const boxes of stepBoxes) {
    loaded.push(...boxes);
    const { scene, span } = buildCaptureScene(layout, loaded, colorOf, labelOf);
    try {
      camera.position.set(span * 0.95, span * 0.72, span * 1.3);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      images.push(toJpeg(renderer.domElement));
    } finally {
      disposeScene(scene);
    }
  }
  return images;
}
