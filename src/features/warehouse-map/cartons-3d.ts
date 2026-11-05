/**
 * Hàng trên kệ ở 3D — thuần, không side effect. Thùng carton CHỈ vẽ ở vị trí có dòng tồn thật (API tồn
 * theo vị trí), số thùng quy từ số lượng tồn; bản đồ vẫn chỉ trực quan, nguồn sự thật là tồn (BR-05).
 * Lệch nhẹ vị trí / góc / cao / sắc giấy theo mã bin (băm, không ngẫu nhiên) để chồng thùng trông thật
 * mà vẽ lại vẫn y hệt.
 */

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import { levelFloorY, shelfFrame } from "./rack-3d";
import { boxOf, levelSpan, shelfHeight } from "./selectors";

import type { LayoutArea, LayoutShelf } from "./types";

/** Một thùng carton; mặt +z cục bộ (mặt in tem) quay ra lối lấy hàng. */
export interface CartonPart {
  position: [number, number, number];
  size: [number, number, number];
  /** Góc quay quanh trục dọc (rad). */
  yaw: number;
  /** Sắc giấy kraft 0 / 1 / 2. */
  shade: number;
}

/** Dòng tồn tối thiểu bản đồ đọc (BE `WarehouseStockItemResponse`). */
export interface LocationStockRow {
  locationCode: string;
  sku?: string | null;
  onHand?: number | null;
}

/** Tổng tồn theo mã vị trí; dòng ẩn số lượng (đang kiểm kê) → `null` = có hàng, không rõ bao nhiêu. */
export function stockByLocation(rows: readonly LocationStockRow[]): Map<string, number | null> {
  const totals = new Map<string, number | null>();
  for (const row of rows) {
    const previous = totals.has(row.locationCode) ? totals.get(row.locationCode) : 0;
    totals.set(
      row.locationCode,
      previous == null || row.onHand == null ? null : previous + row.onHand,
    );
  }
  return totals;
}

/** Băm FNV-1a → số 0..1 ổn định cho (mã, thứ tự). */
function noise(seed: string, index: number): number {
  let hash = 2166136261;
  for (const char of `${seed}#${index}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295;
}

export function cartonParts(
  shelf: LayoutShelf,
  stock: ReadonlyMap<string, number | null>,
): CartonPart[] {
  const { theta, toWorld, faceZ } = shelfFrame(shelf);
  const faceSign = faceZ === 0 ? -1 : 1;
  const parts: CartonPart[] = [];
  for (const level of shelf.levels)
    for (const bin of level.bins) {
      if (!stock.has(bin.locationCode)) continue;
      const pallet = bin.type === "PALLET";
      const base = levelFloorY(level) + (pallet ? R.pallet : 0);
      const room = levelSpan(level).height - (pallet ? R.pallet : 0) - 0.12;
      const height = Math.min(R.cartonHeight, room);
      if (height < 0.1) continue;
      const f = bin.footprint;
      const [cols, rows] = pallet ? [2, 2] : [2, 1];
      const areaW = f.width * (pallet ? 0.82 : 0.8);
      const areaD = f.length * (pallet ? 0.85 : 0.75);
      const [w, d] = [areaW / cols - R.cartonGap, areaD / rows - R.cartonGap];
      const perLayer = cols * rows;
      const capacity = perLayer * Math.max(1, Math.floor(room / height));
      const units = stock.get(bin.locationCode);
      const count =
        units == null
          ? Math.ceil(capacity / 2)
          : Math.min(capacity, Math.max(1, Math.ceil(units / R.cartonUnits)));
      for (let i = 0; i < count; i += 1) {
        const rand = (k: number) => noise(bin.locationCode, i * 5 + k);
        const [slot, layer] = [i % perLayer, Math.floor(i / perLayer)];
        const [col, row] = [slot % cols, Math.floor(slot / cols)];
        const h = height * (0.9 + 0.1 * rand(0));
        const lx = f.x + (f.width - areaW) / 2 + ((col + 0.5) * areaW) / cols;
        const lz = f.y + (f.length - areaD) / 2 + ((row + 0.5) * areaD) / rows;
        const [x, z] = toWorld(lx + (rand(1) - 0.5) * 0.03, lz + (rand(2) - 0.5) * 0.03);
        // Mặt in tem (+z cục bộ) hướng ra lối lấy hàng: kệ chỉ mở mặt bắc thì quay ngược thùng
        const yaw = -theta + (faceSign < 0 ? Math.PI : 0) + (rand(3) - 0.5) * 0.08;
        const y = base + layer * height + h / 2;
        parts.push({ position: [x, y, z], size: [w, h, d], yaw, shade: Math.floor(rand(4) * 3) });
      }
    }
  return parts;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

const clampDistance = (value: number) => Math.min(Math.max(value, R.focusMin), R.focusMax);

/** Camera nhìn chéo 3/4 vào mặt lấy hàng của kệ, đủ xa để thấy trọn kệ. */
export function shelfFocusPose(shelf: LayoutShelf): CameraPose {
  const b = boxOf(shelf.footprint);
  const height = shelfHeight(shelf);
  const { faceNormal, theta } = shelfFrame(shelf);
  const distance = clampDistance(Math.max(shelf.footprint.width * 0.8, height * 1.7));
  const [cx, cz] = [b.x + b.w / 2, b.y + b.h / 2];
  const side = distance * 0.35;
  return {
    position: [
      cx + faceNormal[0] * distance + Math.cos(theta) * side,
      height * 0.75 + distance * 0.3,
      cz + faceNormal[1] * distance + Math.sin(theta) * side,
    ],
    target: [cx, height * 0.45, cz],
  };
}

/** Camera nhìn từ phía nam xuống khu vực. */
export function areaFocusPose(area: LayoutArea): CameraPose {
  const b = boxOf(area.footprint);
  const distance = clampDistance(Math.max(b.w, b.h) * 0.9);
  const [cx, cz] = [b.x + b.w / 2, b.y + b.h / 2];
  return {
    position: [cx + distance * 0.3, distance * 0.8, cz + distance],
    target: [cx, 0, cz],
  };
}

/** Toàn cảnh: từ góc đông-nam nhìn vào giữa kho. */
export function overviewPose(width: number, height: number): CameraPose {
  const span = Math.max(width, height);
  return {
    position: [width * 1.1, span * 0.6, height * 1.25],
    target: [width / 2, 0, height / 2],
  };
}
