/**
 * Dựng trình tự xếp từng bước từ các xe đã xếp (gộp `steps.ts` và `easycargo-steps.ts` — hai bản
 * giống hệt nhau trừ chú thích). Mỗi bước là một KHỐI: các kiện cùng mặt hàng chạm mặt nhau.
 *
 * Thứ tự: khối chỉ được xếp sau khi mọi khối nó tựa lên đã xếp (sắp thứ tự tô-pô, chống bước
 * "treo"); trong số khối sẵn sàng thì ưu tiên sâu nhất (z nhỏ = sát vách đầu xe, xa cửa) → thấp
 * nhất → trái nhất (x nhỏ), để người xếp đi từ cuối xe ra phía cửa.
 */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import type { BlockMm, Layout, LayoutBox } from "../types";

const TOL = LOAD_PLANNING_LIMITS.blockAdjacencyToleranceMm;

export interface LoadingStep extends BlockMm {
  /** Thứ tự bước trong cả kế hoạch, từ 1 (đánh lại liên tục qua các xe). */
  seq: number;
  vehicleSeq: number;
  vehicleCode: string;
  label: string;
  partName: string;
  count: number;
  /** Các kiện của khối này — để dựng ảnh cộng dồn từng bước. */
  boxes: LayoutBox[];
}

type Extent1D = readonly [number, number];

const overlaps1d = ([a0, a1]: Extent1D, [b0, b1]: Extent1D): boolean =>
  Math.min(a1, b1) - Math.max(a0, b0) > TOL;
const touches1d = ([a0, a1]: Extent1D, [b0, b1]: Extent1D): boolean =>
  Math.abs(a1 - b0) < TOL || Math.abs(b1 - a0) < TOL;

const spanX = (b: BlockMm): Extent1D => [b.xMm, b.xMm + b.wMm];
const spanY = (b: BlockMm): Extent1D => [b.yMm, b.yMm + b.hMm];
const spanZ = (b: BlockMm): Extent1D => [b.zMm, b.zMm + b.dMm];

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
 * Khoá dòng: mã + tên + kích thước DANH ĐỊNH đã sắp xếp. Cùng mã hai cỡ → hai khối khác nhau; còn
 * một kiện xoay vẫn cùng khoá (cùng bộ ba cạnh), nên không bị tách khỏi khối của nó.
 */
function lineKey(box: LayoutBox): string {
  const sides = [box.origMm.l, box.origMm.w, box.origMm.h].sort((a, b) => a - b);
  return `${box.label}|${box.partName}|${sides.join("|")}`;
}

function groupAdjacent(boxes: readonly LayoutBox[]): LayoutBox[][] {
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
      if (keys[i] === keys[j] && adjacent(boxes[i], boxes[j])) parent[find(i)] = find(j);
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

interface Block extends BlockMm {
  boxes: LayoutBox[];
}

function toBlock(boxes: LayoutBox[]): Block {
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

/** Khối đang tựa lên những khối nào (mặt đỉnh chạm đáy và chồng nhau trên x, z)? Trên sàn → không. */
function supportersOf(blocks: readonly Block[]): number[][] {
  return blocks.map((upper) => {
    if (upper.yMm < TOL) return [];
    const result: number[] = [];
    blocks.forEach((lower, j) => {
      if (lower === upper) return;
      if (
        Math.abs(lower.yMm + lower.hMm - upper.yMm) < TOL &&
        overlaps1d(spanX(upper), spanX(lower)) &&
        overlaps1d(spanZ(upper), spanZ(lower))
      ) {
        result.push(j);
      }
    });
    return result;
  });
}

function orderBlocks(blocks: readonly Block[]): Block[] {
  const supporters = supportersOf(blocks);
  const done = new Array<boolean>(blocks.length).fill(false);
  const ordered: Block[] = [];
  for (let step = 0; step < blocks.length; step++) {
    const open = blocks.map((_, i) => i).filter((i) => !done[i]);
    const ready = open.filter((i) => supporters[i].every((j) => done[j]));
    // Nếu có vòng phụ thuộc (dữ liệu hỏng) thì vẫn phải tiến tiếp thay vì kẹt vô hạn.
    const pool = ready.length > 0 ? ready : open;
    pool.sort(
      (a, b) =>
        blocks[a].zMm - blocks[b].zMm ||
        blocks[a].yMm - blocks[b].yMm ||
        blocks[a].xMm - blocks[b].xMm,
    );
    done[pool[0]] = true;
    ordered.push(blocks[pool[0]]);
  }
  return ordered;
}

export function buildLoadingSteps(layouts: readonly Layout[]): LoadingStep[] {
  const steps: LoadingStep[] = [];
  for (const layout of layouts) {
    const blocks = groupAdjacent(layout.boxes).map(toBlock);
    for (const block of orderBlocks(blocks)) {
      const [first] = block.boxes;
      steps.push({
        seq: steps.length + 1,
        vehicleSeq: layout.seq,
        vehicleCode: layout.code,
        label: first.label,
        partName: first.partName,
        count: block.boxes.length,
        xMm: block.xMm,
        yMm: block.yMm,
        zMm: block.zMm,
        wMm: block.wMm,
        hMm: block.hMm,
        dMm: block.dMm,
        boxes: block.boxes,
      });
    }
  }
  return steps;
}
