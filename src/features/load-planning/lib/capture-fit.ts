/** Căn khung và cắt viền trắng cho ảnh chụp xe (gốc: `fitDistance`, `trimWhite` trong `easycargo-capture.ts`). */

import type { PerspectiveCamera, Vector3 } from "three";

/** Chừa ~8% lề quanh xe. */
const FRAME_MARGIN = 0.92;
const FIT_ITERATIONS = 4;
const START_DISTANCE = 30;
/** Pixel có kênh nào dưới mức này mới tính là "có nội dung" (nền trắng = 255). */
const CONTENT_THRESHOLD = 245;
const JPEG_QUALITY = 0.82;

/**
 * Khoảng cách dọc `direction` để mọi góc của xe vừa khung nhìn kèm lề. Cách cố định cũ chừa viền
 * trắng rất rộng quanh xe dài, đẩy hai ảnh TRÁI/PHẢI sang hai trang in khác nhau.
 */
export function fitDistance(
  camera: PerspectiveCamera,
  direction: Vector3,
  corners: readonly Vector3[],
): number {
  let distance = START_DISTANCE;
  for (let i = 0; i < FIT_ITERATIONS; i++) {
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    let extent = 0;
    for (const corner of corners) {
      const p = corner.clone().project(camera);
      extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
    }
    if (extent < 1e-6) break;
    // Gần như tuyến tính theo khoảng cách nên vài vòng là hội tụ.
    distance = (distance * extent) / FRAME_MARGIN;
  }
  return distance;
}

export interface CapturedView {
  dataUrl: string;
  /** Cao/rộng của ảnh — ảnh đã cắt theo nội dung nên bố cục in phải dùng tỉ lệ riêng của nó. */
  aspect: number;
}

/**
 * Cắt viền trắng còn lại quanh xe (hình chiếu phối cảnh chéo không bao giờ lấp đầy khung chữ nhật);
 * ảnh sát nội dung mới cho phép xếp hai góc nhìn trên MỘT trang ở bề rộng đầy đủ.
 */
export function trimWhite(source: HTMLCanvasElement, pad = 16): CapturedView {
  const { width: w, height: h } = source;
  const scan = document.createElement("canvas");
  scan.width = w;
  scan.height = h;
  const ctx = scan.getContext("2d");
  if (!ctx) return { dataUrl: source.toDataURL("image/jpeg", JPEG_QUALITY), aspect: h / w };
  ctx.drawImage(source, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (
        px[i] < CONTENT_THRESHOLD ||
        px[i + 1] < CONTENT_THRESHOLD ||
        px[i + 2] < CONTENT_THRESHOLD
      ) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return { dataUrl: source.toDataURL("image/jpeg", JPEG_QUALITY), aspect: h / w };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const cropW = x1 - x0 + 1;
  const cropH = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  out.getContext("2d")?.drawImage(source, x0, y0, cropW, cropH, 0, 0, cropW, cropH);
  return { dataUrl: out.toDataURL("image/jpeg", JPEG_QUALITY), aspect: cropH / cropW };
}

/** Ảnh JPEG nhỏ hơn PNG ~5–10 lần mà không mất chất lượng đáng kể với cảnh 3D đã khử răng cưa. */
export function toJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
