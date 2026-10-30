/**
 * Bản nháp → danh sách request theo thứ tự an toàn (BE không có giao dịch gộp). Thứ tự giảm va chạm
 * BR-07 giữa chừng: zone trước (kệ cần zoneId), rồi gỡ hình bị xoá (Inactive thì nhả chỗ), rồi dời /
 * sửa hình cũ, rồi tạo hình mới, tường / cửa cuối. Thuần, không side effect.
 */

import { UI_LABELS } from "@/constants";

import { isChanged } from "./draft";

import type { DraftArea, DraftBoundary, DraftItem, DraftShelf, DraftZone, MapDraft } from "./draft";

const OP = UI_LABELS.warehouseMap.edit.op;

export type SaveOp =
  | { type: "zone"; zone: DraftZone }
  | { type: "remove"; item: DraftItem }
  | { type: "shelf"; item: DraftShelf }
  | { type: "area"; item: DraftArea }
  | { type: "boundary"; item: DraftBoundary };

const rank = (op: SaveOp): number => {
  if (op.type === "zone") return 0;
  if (op.type === "remove") return 1;
  const fresh = op.item.id === null ? 2 : 0;
  return op.type === "boundary" ? 5 + fresh / 2 : 2 + fresh;
};

export function planDraftSave(draft: MapDraft): SaveOp[] {
  const ops: SaveOp[] = [
    ...draft.zones
      .filter((zone) => isChanged(draft, zone))
      .map((zone) => ({ type: "zone" as const, zone })),
    ...draft.removed.map((item) => ({ type: "remove" as const, item })),
    ...draft.items
      .filter((item) => isChanged(draft, item))
      .map((item): SaveOp => {
        if (item.kind === "shelf") return { type: "shelf", item };
        if (item.kind === "area") return { type: "area", item };
        return { type: "boundary", item };
      }),
  ];
  // sort ổn định: cùng hạng giữ thứ tự trong bản nháp
  return ops
    .map((op, index) => ({ op, index }))
    .sort((a, b) => rank(a.op) - rank(b.op) || a.index - b.index)
    .map(({ op }) => op);
}

/** Nhãn bước để báo "dừng ở bước nào" khi một request hỏng. */
export function saveOpLabel(op: SaveOp): string {
  switch (op.type) {
    case "zone":
      return op.zone.id ? OP.zoneUpdate(op.zone.name) : OP.zoneCreate(op.zone.name);
    case "remove":
      return op.item.kind === "boundary" ? OP.boundaryDelete : OP.deactivate(op.item.code);
    case "shelf":
      return op.item.id ? OP.shelfUpdate(op.item.code) : OP.shelfCreate(op.item.code);
    case "area":
      return op.item.id ? OP.areaUpdate(op.item.code) : OP.areaCreate(op.item.code);
    case "boundary":
      return op.item.id ? OP.boundaryUpdate : OP.boundaryCreate;
  }
}
