/**
 * Vị trí camera cho bốn góc nhìn nhanh. Xe 40'/45' rất dài, khó đọc từ góc chéo mặc định nên một
 * cú bấm đưa camera về khung dễ nhìn. z hướng về phía cửa xe. (Gốc: `CameraPreset`.)
 */

import type { ViewKind } from "@/constants";
import type { Vec3 } from "./scene";

/** Độ lệch nhỏ để camera nhìn thẳng xuống không bị lật trục (gimbal). */
const TOP_EPSILON = 0.0001;

export function cameraPosition(kind: ViewKind, distance: number, sceneHeight: number): Vec3 {
  switch (kind) {
    case "top":
      return [0, distance * 1.3, TOP_EPSILON];
    case "side":
      return [distance * 1.2, sceneHeight * 0.6, 0];
    case "end":
      // Nhìn vào từ phía cửa (z dương).
      return [0, sceneHeight * 0.6, distance * 1.2];
    case "iso":
      return [distance, distance * 0.75, distance];
  }
}
