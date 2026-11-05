/**
 * Dựng kệ pallet 3D (selective racking) từ dữ liệu kệ — thuần, không side effect, để instancing: mỗi
 * chi tiết là một hộp (vị trí tâm, cỡ, góc) trong toạ độ thế giới (x = x bản đồ, z = y bản đồ, y = cao).
 * Khung cột ở mỗi ranh khoang (theo ranh bin), giằng chéo hai bên, beam + sàn lưới ở mỗi tầng trên
 * cao, pallet / thùng theo LOẠI bin (dữ liệu BE — không vẽ hàng: bản đồ không phải nguồn tồn, BR-05).
 */

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import { levelSpan, planLevel, shelfHeight, shelfTransform } from "./selectors";

import type { LayoutLevel, LayoutShelf } from "./types";

export type RackPartKind = "upright" | "brace" | "beam" | "deck" | "pallet" | "tote" | "label";

export interface RackPart {
  shelfId: string;
  kind: RackPartKind;
  position: [number, number, number];
  size: [number, number, number];
  /** Quay quanh trục dọc (theo kệ) rồi quanh trục X cục bộ (giằng chéo) — thứ tự Euler "YXZ". */
  rotation: [number, number];
  /** Bin của nhãn / pallet — để tô nhãn theo trạng thái. */
  binUsable?: boolean;
  binStatus?: string;
}

type Local = { x: number; y: number; z: number; w: number; h: number; d: number; tilt?: number };

/** Ranh khoang theo trục rộng của kệ: mép kệ + mọi mép bin của tầng thấp nhất. */
export function bayEdges(shelf: Pick<LayoutShelf, "footprint" | "levels">): number[] {
  const width = shelf.footprint.width;
  const edges = new Set<number>([0, width]);
  for (const bin of planLevel(shelf)?.bins ?? []) {
    edges.add(Math.round(bin.footprint.x * 1000) / 1000);
    edges.add(Math.round((bin.footprint.x + bin.footprint.width) * 1000) / 1000);
  }
  return [...edges].filter((x) => x >= 0 && x <= width).sort((a, b) => a - b);
}

/**
 * Khung cục bộ của kệ (x theo bề rộng, z theo chiều sâu) → bản đồ, xoay theo chiều kim đồng hồ như 2D
 * (`shelfTransform`). `faceZ`: z cục bộ của mặt lấy hàng (nam, hoặc bắc nếu chỉ mở mặt bắc).
 */
export function shelfFrame(shelf: Pick<LayoutShelf, "footprint" | "pickFaces">) {
  const { tx, ty, deg } = shelfTransform(shelf.footprint);
  const theta = (deg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
  const northOnly = shelf.pickFaces.north && !shelf.pickFaces.south;
  return {
    theta,
    toWorld: (x: number, z: number): [number, number] => [
      tx + x * cos - z * sin,
      ty + x * sin + z * cos,
    ],
    faceZ: northOnly ? 0 : shelf.footprint.length,
    /** Pháp tuyến mặt lấy hàng trên bản đồ (x, z). */
    faceNormal: (northOnly ? [sin, -cos] : [-sin, cos]) as [number, number],
  };
}

/** Mặt đặt hàng của một tầng: sát sàn, hoặc trên beam + sàn lưới với tầng trên cao. */
export function levelFloorY(level: Pick<LayoutLevel, "levelIndex" | "elevation" | "usableHeight">) {
  const { bottom } = levelSpan(level);
  return bottom > 0.05 ? bottom + R.beamHeight / 2 + R.deck : 0;
}

/** `stocked`: mã vị trí đang vẽ thùng carton (hàng thật) → bỏ thùng nhựa rỗng ở đó. */
export function rackParts(shelf: LayoutShelf, stocked?: ReadonlySet<string>): RackPart[] {
  const { width: sw, length: sl } = shelf.footprint;
  const { theta, toWorld, faceZ } = shelfFrame(shelf);
  const top = shelfHeight(shelf) + 0.1;
  const parts: RackPart[] = [];
  const add = (kind: RackPartKind, p: Local, bin?: { usable: boolean; status: string }) => {
    const [x, z] = toWorld(p.x, p.z);
    parts.push({
      shelfId: shelf.id,
      kind,
      position: [x, p.y, z],
      size: [p.w, p.h, p.d],
      rotation: [-theta, p.tilt ?? 0],
      binUsable: bin?.usable,
      binStatus: bin?.status,
    });
  };

  const edges = bayEdges(shelf);
  const zFront = R.post / 2;
  const zBack = sl - R.post / 2;
  for (const x of edges) {
    const px = Math.min(Math.max(x, R.post / 2), sw - R.post / 2);
    add("upright", { x: px, y: top / 2, z: zFront, w: R.post, h: top, d: R.post });
    add("upright", { x: px, y: top / 2, z: zBack, w: R.post, h: top, d: R.post });
    // Giằng chéo zig-zag giữa cột trước / sau của khung
    const depth = zBack - zFront;
    for (let y = 0.15, up = true; y + R.braceStep <= top; y += R.braceStep, up = !up) {
      const length = Math.hypot(depth, R.braceStep);
      const tilt = Math.atan2(depth, R.braceStep) * (up ? 1 : -1);
      add("brace", {
        x: px,
        y: y + R.braceStep / 2,
        z: sl / 2,
        w: R.brace,
        h: length,
        d: R.brace,
        tilt,
      });
    }
  }

  for (const level of shelf.levels) {
    const { bottom, height } = levelSpan(level);
    const raised = bottom > 0.05;
    const floorY = levelFloorY(level);
    for (let i = 0; raised && i < edges.length - 1; i += 1) {
      const [a = 0, b = 0] = [edges[i], edges[i + 1]];
      const mid = (a + b) / 2;
      for (const z of [R.beamDepth / 2, sl - R.beamDepth / 2])
        add("beam", { x: mid, y: bottom, z, w: b - a, h: R.beamHeight, d: R.beamDepth });
      add("deck", {
        x: mid,
        y: bottom + R.beamHeight / 2 + R.deck / 2,
        z: sl / 2,
        w: b - a - R.post,
        h: R.deck,
        d: sl - R.beamDepth * 2,
      });
    }
    for (const bin of level.bins) {
      const f = bin.footprint;
      const cx = f.x + f.width / 2;
      const cz = f.y + f.length / 2;
      const state = { usable: bin.usable, status: bin.effectiveStatus };
      if (bin.type === "PALLET")
        add(
          "pallet",
          {
            x: cx,
            y: floorY + R.pallet / 2,
            z: cz,
            w: f.width * 0.82,
            h: R.pallet,
            d: f.length * 0.85,
          },
          state,
        );
      else if (!stocked?.has(bin.locationCode)) {
        const h = Math.min(R.tote, height * 0.5);
        add(
          "tote",
          { x: cx, y: floorY + h / 2, z: cz, w: f.width * 0.7, h, d: f.length * 0.7 },
          state,
        );
      }
      // Nhãn vị trí trên beam mặt lấy hàng (tầng sát sàn: dán thấp trên cột)
      const labelY = raised ? bottom : 0.2;
      const offset = faceZ === 0 ? -0.004 : 0.004;
      add(
        "label",
        {
          x: cx,
          y: labelY,
          z: faceZ + offset,
          w: Math.min(R.labelWidth, f.width * 0.5),
          h: R.labelHeight,
          d: 0.006,
        },
        state,
      );
    }
  }
  return parts;
}
