/**
 * Thiết bị đặc trưng của từng loại khu vực trên cảnh 3D (docs 06 §5 "Loại khu vực") — thuần, chỉ trang trí cho
 * dễ nhận ra khu: KHÔNG vẽ hàng (pallet / thùng) vì bản đồ không phải nguồn tồn (BR-05). Dựng trong khung thẳng
 * của khu (`boxOf`, đã tính góc xoay 90°), co theo cỡ khu; khu quá nhỏ, khu vật cản, khu không ACTIVE thì bỏ.
 *
 * - RECEIVING: bục kiểm đếm có máy quét, xe nâng tay.
 * - QUARANTINE: cọc dây chắn đỏ quanh khu, chừa lối vào.
 * - STAGING (§4.5): vạch làn + biển đơn ở đầu mỗi làn (giữ riêng thùng theo đơn).
 * - DISPATCH (BR-22): bục quét kiểm thùng, xe đẩy máy in nhãn giao, vạch làn gom shipment.
 * - OVERFLOW (05 BR-13): cột đo chiều cao xếp, vạch vàng mỗi 0.5 m.
 * - PRODUCTION: máy in + bàn thao tác.
 * - NON_STORAGE: không thêm gì (khu vật cản đã dựng thành khối).
 */

import { LOCATION_STATUS } from "@/constants";

import { boxOf } from "./selectors";

import type { LayoutArea } from "./types";

export type AreaPropKind = "metal" | "rubber" | "top" | "hazard" | "belt" | "sign";
export type AreaPropShape = "box" | "cylinder";

export interface AreaPropPart {
  areaId: string;
  kind: AreaPropKind;
  shape: AreaPropShape;
  /** Tâm (x thế giới, y cao, z thế giới). */
  position: [number, number, number];
  size: [number, number, number];
  /** Quay quanh trục dọc, nghiêng quanh trục X cục bộ (như chi tiết kệ). */
  rotation: [number, number];
}

/** Khu nhỏ hơn thế này (m) thì không đặt thiết bị — chật, đè nhãn khu. */
const MIN_SIDE = 2;

type Put = (
  kind: AreaPropKind,
  shape: AreaPropShape,
  local: [number, number, number],
  size: [number, number, number],
) => void;

const podium = (put: Put, x: number, z: number) => {
  put("metal", "box", [x, 0.015, z], [0.4, 0.03, 0.4]);
  put("metal", "box", [x, 0.52, z], [0.08, 1.02, 0.08]);
  put("top", "box", [x, 1.05, z], [0.7, 0.04, 0.5]);
  put("rubber", "box", [x + 0.15, 1.1, z], [0.07, 0.05, 0.16]);
};

const sign = (put: Put, x: number, z: number) => {
  put("rubber", "cylinder", [x, 0.015, z], [0.28, 0.03, 0.28]);
  put("metal", "cylinder", [x, 0.7, z], [0.05, 1.4, 0.05]);
  put("sign", "box", [x, 1.45, z], [0.42, 0.28, 0.02]);
};

const cart = (put: Put, x: number, z: number) => {
  for (const y of [0.3, 0.85]) put("metal", "box", [x, y, z], [0.6, 0.03, 0.5]);
  for (const dx of [-0.28, 0.28])
    for (const dz of [-0.23, 0.23]) {
      put("metal", "box", [x + dx, 0.45, z + dz], [0.03, 0.85, 0.03]);
      put("rubber", "cylinder", [x + dx, 0.06, z + dz], [0.11, 0.04, 0.11]);
    }
  put("rubber", "box", [x, 0.99, z], [0.34, 0.24, 0.3]);
};

function propsOf(area: LayoutArea, w: number, h: number, put: Put) {
  switch (area.type) {
    case "RECEIVING": {
      podium(put, 0.7, h - 0.6);
      const [jx, jz] = [w - 1.4, h - 0.7];
      for (const dz of [-0.18, 0.18]) put("hazard", "box", [jx, 0.08, jz + dz], [1.15, 0.07, 0.16]);
      put("hazard", "box", [jx + 0.7, 0.18, jz], [0.25, 0.22, 0.56]);
      put("rubber", "box", [jx + 0.95, 0.68, jz], [0.04, 1.05, 0.04]);
      return;
    }
    case "QUARANTINE": {
      const inset = 0.3;
      const [x0, x1, z0, z1] = [inset, w - inset, inset, h - inset];
      const along = (from: number, to: number) => {
        const n = Math.max(1, Math.round((to - from) / 1.2));
        return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
      };
      const xs = along(x0, x1);
      const zs = along(z0, z1);
      const posts = [
        ...xs.flatMap((x) => [[x, z0] as const, [x, z1] as const]),
        ...zs.slice(1, -1).flatMap((z) => [[x0, z] as const, [x1, z] as const]),
      ];
      for (const [x, z] of posts) {
        put("rubber", "cylinder", [x, 0.015, z], [0.32, 0.03, 0.32]);
        put("metal", "cylinder", [x, 0.48, z], [0.056, 0.92, 0.056]);
      }
      // Dây chắn ba cạnh, cạnh dưới chừa đoạn cuối làm lối vào
      for (let i = 0; i < xs.length - 1; i += 1) {
        const [a = 0, b = 0] = [xs[i], xs[i + 1]];
        put("belt", "box", [(a + b) / 2, 0.9, z0], [b - a, 0.05, 0.006]);
        if (i < xs.length - 2) put("belt", "box", [(a + b) / 2, 0.9, z1], [b - a, 0.05, 0.006]);
      }
      for (const x of [x0, x1]) put("belt", "box", [x, 0.9, (z0 + z1) / 2], [0.006, 0.05, z1 - z0]);
      return;
    }
    case "STAGING":
    case "DISPATCH": {
      const lanes = Math.max(1, Math.floor(h / 2.2));
      for (let i = 1; i < lanes; i += 1)
        put("hazard", "box", [w / 2 + 0.4, 0.006, (h * i) / lanes], [w - 1.2, 0.004, 0.05]);
      if (area.type === "STAGING")
        for (let i = 0; i < lanes; i += 1) sign(put, 0.45, (h * (i + 0.5)) / lanes);
      else {
        podium(put, 0.6, 0.9);
        if (h > 2.8) cart(put, 0.6, h - 0.8);
      }
      return;
    }
    case "OVERFLOW": {
      const [gx, gz] = [w - 0.25, 0.25];
      put("rubber", "cylinder", [gx, 0.015, gz], [0.24, 0.03, 0.24]);
      put("metal", "cylinder", [gx, 1.5, gz], [0.06, 3, 0.06]);
      for (let y = 0.5; y < 3; y += 0.5)
        put("hazard", "cylinder", [gx, y, gz], [0.068, 0.08, 0.068]);
      return;
    }
    case "PRODUCTION": {
      const [mx, mz] = [Math.min(2, w / 2), h / 2];
      put("metal", "box", [mx, 0.6, mz], [1.8, 1.2, 1.1]);
      put("rubber", "box", [mx, 1.25, mz], [1.6, 0.1, 0.9]);
      put("rubber", "box", [mx - 0.7, 1.45, mz - 0.4], [0.3, 0.25, 0.04]);
      if (w > 4.5) {
        const tx = mx + 2.2;
        put("top", "box", [tx, 0.9, mz], [1.6, 0.05, 0.8]);
        for (const dx of [-0.75, 0.75])
          for (const dz of [-0.35, 0.35])
            put("metal", "box", [tx + dx, 0.44, mz + dz], [0.045, 0.88, 0.045]);
      }
      return;
    }
    default:
      return;
  }
}

export function areaPropParts(areas: readonly LayoutArea[]): AreaPropPart[] {
  const parts: AreaPropPart[] = [];
  for (const area of areas) {
    if (area.obstacle || area.effectiveStatus !== LOCATION_STATUS.ACTIVE) continue;
    const b = boxOf(area.footprint);
    if (b.w < MIN_SIDE || b.h < MIN_SIDE) continue;
    propsOf(area, b.w, b.h, (kind, shape, [x, y, z], size) =>
      parts.push({
        areaId: area.id,
        kind,
        shape,
        position: [b.x + x, y, b.y + z],
        size,
        rotation: [0, 0],
      }),
    );
  }
  return parts;
}
