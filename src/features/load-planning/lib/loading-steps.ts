/**
 * Dựng trình tự xếp từng bước từ các xe đã xếp (gộp `steps.ts` và `easycargo-steps.ts` — hai bản
 * giống hệt nhau trừ chú thích). Mỗi bước là một KHỐI: các kiện cùng mặt hàng chạm mặt nhau.
 *
 * Thứ tự: một khối chỉ được xếp khi MỌI KIỆN của nó đã có chỗ tựa — kiện nào tựa lên kiện thuộc
 * khối khác thì khối đó phải xếp trước (chống bước "treo"). Phụ thuộc tính theo từng kiện, không
 * theo hộp bao của khối: khối có một kiện nằm sàn vẫn có thể có kiện phía trên tựa lên mặt hàng khác.
 * Trong số khối sẵn sàng thì ưu tiên sâu nhất (z nhỏ = sát vách đầu xe, xa cửa) → thấp nhất → trái
 * nhất (x nhỏ), để người xếp đi từ cuối xe ra phía cửa. (Gốc chỉ xét hộp bao nên có thể treo.)
 *
 * Nếu các khối tựa vào nhau thành vòng (khối X đỡ Y đỡ lại X) thì tách khối theo tầng, rồi theo
 * từng kiện, cho tới khi có thứ tự hợp lệ. Dữ liệu hỏng đến mức vòng tồn tại ở cấp kiện (kiện đỡ
 * lẫn nhau trong dung sai) thì xếp theo vị trí thay vì lặp vô hạn.
 */

import { TOL, groupAdjacent, overlaps1d, spanX, spanZ, toBlock } from "./block-grouping";

import type { Block } from "./block-grouping";
import type { BlockMm, Layout, LayoutBox } from "../types";

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

/** `upper` có tựa lên `lower` (đỉnh `lower` chạm đáy `upper`, chồng nhau trên x và z)? Kiện nằm sàn thì không tựa gì. */
function rests(upper: BlockMm, lower: BlockMm): boolean {
  return (
    upper.yMm >= TOL &&
    Math.abs(lower.yMm + lower.hMm - upper.yMm) < TOL &&
    overlaps1d(spanX(upper), spanX(lower)) &&
    overlaps1d(spanZ(upper), spanZ(lower))
  );
}

/** Mỗi kiện → các kiện nó đang tựa lên. */
function supportMap(boxes: readonly LayoutBox[]): Map<LayoutBox, LayoutBox[]> {
  return new Map(
    boxes.map((upper) => [upper, boxes.filter((lower) => lower !== upper && rests(upper, lower))]),
  );
}

function canLoad(
  block: Block,
  supports: ReadonlyMap<LayoutBox, readonly LayoutBox[]>,
  loaded: ReadonlySet<LayoutBox>,
) {
  const own = new Set(block.boxes);
  return block.boxes.every((box) =>
    (supports.get(box) ?? []).every((s) => own.has(s) || loaded.has(s)),
  );
}

const byPosition = (a: BlockMm, b: BlockMm): number =>
  a.zMm - b.zMm || a.yMm - b.yMm || a.xMm - b.xMm;

const firstByPosition = (blocks: readonly Block[]): Block =>
  blocks.reduce((best, block) => (byPosition(block, best) < 0 ? block : best));

/** Tách khối bị kẹt: trước hết theo tầng (cùng cao độ), nếu đã một tầng thì tới từng kiện. */
function splitBlock(block: Block): Block[] {
  if (block.boxes.length === 1) return [block];
  const layers = groupAdjacent(block.boxes, true).map(toBlock);
  return layers.length > 1 ? layers : block.boxes.map((box) => toBlock([box]));
}

function orderBlocks(
  initial: readonly Block[],
  supports: ReadonlyMap<LayoutBox, readonly LayoutBox[]>,
): Block[] {
  let open = [...initial];
  const loaded = new Set<LayoutBox>();
  const ordered: Block[] = [];
  const take = (block: Block) => {
    ordered.push(block);
    block.boxes.forEach((box) => loaded.add(box));
    open = open.filter((b) => b !== block);
  };
  while (open.length > 0) {
    const ready = open.filter((block) => canLoad(block, supports, loaded));
    if (ready.length > 0) {
      take(firstByPosition(ready));
      continue;
    }
    const split = open.flatMap(splitBlock);
    // Không tách thêm được mà vẫn kẹt: dữ liệu hỏng (kiện đỡ lẫn nhau) — xếp theo vị trí để kết thúc.
    if (split.length === open.length) take(firstByPosition(open));
    else open = split;
  }
  return ordered;
}

export function buildLoadingSteps(layouts: readonly Layout[]): LoadingStep[] {
  const steps: LoadingStep[] = [];
  for (const layout of layouts) {
    const blocks = groupAdjacent(layout.boxes).map(toBlock);
    for (const block of orderBlocks(blocks, supportMap(layout.boxes))) {
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
