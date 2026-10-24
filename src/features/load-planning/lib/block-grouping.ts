/**
 * Gom các kiện cùng mặt hàng chạm mặt nhau thành KHỐI (union-find theo kề mặt) — nền của từng
 * bước xếp trong `loading-steps.ts`.
 */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import type { BlockMm, LayoutBox } from "../types";

export const TOL = LOAD_PLANNING_LIMITS.blockAdjacencyToleranceMm;

export type Extent1D = readonly [number, number];

export const overlaps1d = ([a0, a1]: Extent1D, [b0, b1]: Extent1D): boolean =>
  Math.min(a1, b1) - Math.max(a0, b0) > TOL;
const touches1d = ([a0, a1]: Extent1D, [b0, b1]: Extent1D): boolean =>
  Math.abs(a1 - b0) < TOL || Math.abs(b1 - a0) < TOL;

export const spanX = (b: BlockMm): Extent1D => [b.xMm, b.xMm + b.wMm];
const spanY = (b: BlockMm): Extent1D => [b.yMm, b.yMm + b.hMm];
export const spanZ = (b: BlockMm): Extent1D => [b.zMm, b.zMm + b.dMm];

/** Hai kiện thuộc một khối nếu chạm nhau ở một mặt và chồng nhau trên hai trục còn lại. */
function adjacent(p: BlockMm, q: BlockMm): boolean {
  const oX = overlaps1d(spanX(p), spanX(q));
  const oY = overlaps1d(spanY(p), spanY(q));
  const oZ = overlaps1d(spanZ(p), spanZ(q));
  return (
    (touches1d(spanX(p), spanX(q)) && oY && oZ) ||
    (touches1d(spanY(p), spanY(q)) && oX && oZ) ||
    (touches1d(spanZ(p), spanZ(q)) && oX && oY)
  );
}

/**
 * Khoá dòng: tên mặt hàng + kích thước DANH ĐỊNH đã sắp xếp (như bảng "Nội dung" của báo cáo EasyCargo). KHÔNG dùng
 * `label`: BE đặt `label` của hộp là mã nhãn của TỪNG kiện (duy nhất, vd `PKG-SO-…-1`), nên đưa nó vào khoá làm mỗi kiện
 * thành một khối, một bước, một trang in. Cùng tên hai cỡ → hai khối khác nhau; kiện xoay vẫn cùng khoá (cùng bộ ba
 * cạnh), nên không bị tách khỏi khối của nó.
 */
function lineKey(box: LayoutBox): string {
  const sides = [box.origMm.l, box.origMm.w, box.origMm.h].sort((a, b) => a - b);
  return `${box.partName}|${sides.join("|")}`;
}

/**
 * Chia các kiện thành khối: cùng khoá dòng (`lineKey`) và chạm mặt nhau (bắc cầu). Với
 * `sameLayerOnly`, hai kiện còn phải cùng cao độ đáy — dùng để tách một khối thành từng tầng.
 */
export function groupAdjacent(boxes: readonly LayoutBox[], sameLayerOnly = false): LayoutBox[][] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    // nén đường đi: mọi nút trên đường trỏ thẳng về gốc
    let node = i;
    while (parent[node] !== root) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const keys = boxes.map(lineKey);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (keys[i] !== keys[j] || !adjacent(boxes[i], boxes[j])) continue;
      if (sameLayerOnly && Math.abs(boxes[i].yMm - boxes[j].yMm) >= TOL) continue;
      parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, LayoutBox[]>();
  boxes.forEach((box, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(box);
    else groups.set(root, [box]);
  });
  return [...groups.values()];
}

export interface Block extends BlockMm {
  boxes: LayoutBox[];
}

export function toBlock(boxes: LayoutBox[]): Block {
  const x0 = Math.min(...boxes.map((b) => b.xMm));
  const y0 = Math.min(...boxes.map((b) => b.yMm));
  const z0 = Math.min(...boxes.map((b) => b.zMm));
  return {
    xMm: x0,
    yMm: y0,
    zMm: z0,
    wMm: Math.max(...boxes.map((b) => b.xMm + b.wMm)) - x0,
    hMm: Math.max(...boxes.map((b) => b.yMm + b.hMm)) - y0,
    dMm: Math.max(...boxes.map((b) => b.zMm + b.dMm)) - z0,
    boxes,
  };
}

/** `upper` có tựa lên `lower` (đỉnh `lower` chạm đáy `upper`, chồng nhau trên x và z)? Kiện nằm sàn thì không tựa gì. */
