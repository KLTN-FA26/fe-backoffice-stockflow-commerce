/**
 * Thanh chắn ngang ở mặt KHÔNG lấy hàng của kệ (docs 06 BR-08: kệ có bin cho lấy hàng mở ít nhất một mặt lấy
 * hàng — `pickFaces`). Mỗi mặt đóng có một thanh thép sơn vàng an toàn ở giữa khoảng trống của từng tầng, ngay
 * ngoài hàng cột, chạy suốt mặt đó → nhìn 3D là biết mặt nào không lấy hàng được. Thuần, toạ độ CỤC BỘ của kệ
 * như 2D (`ShelfShape`): bắc z = 0, nam z = dài, tây x = 0, đông x = rộng; `rackParts` đưa ra toạ độ thế giới.
 */

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import { levelSpan } from "./selectors";

import type { LayoutShelf } from "./types";

/** Hộp cục bộ của một thanh (tâm + cỡ), cùng dạng chi tiết kệ trong `rack-3d`. */
export interface RailBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

export function railBoxes(
  shelf: Pick<LayoutShelf, "footprint" | "pickFaces" | "levels">,
): RailBox[] {
  const { width: sw, length: sl } = shelf.footprint;
  const faces = shelf.pickFaces;
  const half = R.rail / 2;
  // Dài thêm một thanh mỗi đầu để hai mặt đóng liền nhau gặp nhau ở góc
  const along = { x: sw + R.rail * 2, z: sl + R.rail * 2 };
  const sides: [boolean, (y: number) => RailBox][] = [
    [faces.north, (y) => ({ x: sw / 2, y, z: -half, w: along.x, h: R.rail, d: R.rail })],
    [faces.south, (y) => ({ x: sw / 2, y, z: sl + half, w: along.x, h: R.rail, d: R.rail })],
    [faces.west, (y) => ({ x: -half, y, z: sl / 2, w: R.rail, h: R.rail, d: along.z })],
    [faces.east, (y) => ({ x: sw + half, y, z: sl / 2, w: R.rail, h: R.rail, d: along.z })],
  ];
  const heights = shelf.levels.map((level) => {
    const { bottom, height } = levelSpan(level);
    return bottom + height / 2;
  });
  return sides.flatMap(([open, box]) => (open ? [] : heights.map(box)));
}
