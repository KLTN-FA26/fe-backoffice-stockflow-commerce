/**
 * Màu theo mặt hàng (`partName`) cho khung 3D, bảng và ảnh chụp.
 *
 * Gốc (`nesting-3d-viewer.tsx`) gán màu theo thứ tự gặp đầu tiên, nên đảo thứ tự kiện là đổi màu.
 * Ở đây các tên được sắp xếp (vi-VN) rồi mới gán, nên màu chỉ phụ thuộc TẬP tên: cùng một bộ hàng
 * luôn ra cùng một bảng màu dù kiện nằm ở đâu trong mảng, và khung 3D, chú giải, ảnh in khớp nhau.
 */

import { CAPTURE_PALETTE, VIEWER_PALETTE } from "@/constants";

import type { Layout } from "../types";

export type ColorMap = ReadonlyMap<string, string>;

/** Tên mặt hàng → màu, theo thứ tự chữ cái; quá số màu thì xoay vòng. */
export function buildColorMap(
  partNames: Iterable<string>,
  palette: readonly string[] = VIEWER_PALETTE,
): ColorMap {
  const unique = [...new Set(partNames)].sort((a, b) => a.localeCompare(b, "vi"));
  return new Map(unique.map((name, index) => [name, palette[index % palette.length]]));
}

/** Bảng màu của các xe trong một kế hoạch — dùng chung để một mặt hàng cùng màu ở mọi xe. */
export function colorMapForLayouts(
  layouts: readonly Pick<Layout, "boxes">[],
  palette: readonly string[] = VIEWER_PALETTE,
): ColorMap {
  return buildColorMap(
    layouts.flatMap((layout) => layout.boxes.map((box) => box.partName)),
    palette,
  );
}

export function colorMapForPrint(layouts: readonly Pick<Layout, "boxes">[]): ColorMap {
  return colorMapForLayouts(layouts, CAPTURE_PALETTE);
}

/** Màu của một mặt hàng; tên lạ (không có trong map) rơi về ô đầu của bảng màu. */
export function colorOf(map: ColorMap, partName: string): string {
  return map.get(partName) ?? VIEWER_PALETTE[0];
}
