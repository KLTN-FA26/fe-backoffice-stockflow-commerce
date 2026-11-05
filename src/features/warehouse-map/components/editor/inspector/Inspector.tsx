"use client";

import { Trash2 } from "lucide-react";

import { BOUNDARY_TYPE_LABELS, UI_LABELS } from "@/constants";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { MapDialog } from "../../shared/MapDialog";
import { AreaFields } from "./AreaFields";
import { BoundaryFields } from "./BoundaryFields";
import { ShelfFields } from "./ShelfFields";

import type {
  DraftArea,
  DraftBoundary,
  DraftItem,
  DraftShelf,
  DraftZone,
} from "@/features/warehouse-map/draft";
import type { DraftIssues } from "@/features/warehouse-map/draft-rules";
import type { PlaceLocks, StockState } from "@/features/warehouse-map/lifecycle";

const P = UI_LABELS.warehouseMap.panel;
const ED = UI_LABELS.warehouseMap.edit;
const I = ED.inspector;
const S = ED.stock;

export interface InspectorProps {
  item: DraftItem;
  zones: readonly DraftZone[];
  issues: DraftIssues;
  stock: StockState;
  locks: PlaceLocks;
  changed: boolean;
  onChange: (apply: (item: DraftItem) => DraftItem) => void;
  onRemove: () => void;
  onAddZone: () => void;
  onClose: () => void;
}

function StockNotice({ stock }: { stock: StockState }) {
  if (stock === "free") return null;
  if (stock === "checking") return <Alert tone="info">{S.checking}</Alert>;
  return <Alert tone="warning">{stock === "stocked" ? S.stocked : S.unknown}</Alert>;
}

/**
 * Modal thông số của hình đang chọn trong chế độ sửa — mọi thay đổi vào bản nháp ngay (kéo trên canvas
 * và gõ số là cùng một dữ liệu), lưu khi bấm Lưu. Hình đã lưu: mã khoá (BR-13); vị trí còn hàng chỉ sửa
 * tên / zone (BR-04); "xoá" kệ / khu vực đã lưu = ngừng dùng.
 */
export function Inspector(props: InspectorProps) {
  const { item, locks } = props;
  const saved = item.id !== null;
  const title =
    item.kind === "boundary"
      ? BOUNDARY_TYPE_LABELS[item.type]
      : `${item.kind === "shelf" ? P.shelf : P.area} ${item.code}`;
  const shelf = (patch: Partial<DraftShelf>) =>
    props.onChange((i) => (i.kind === "shelf" ? { ...i, ...patch } : i));
  const area = (patch: Partial<DraftArea>) =>
    props.onChange((i) => (i.kind === "area" ? { ...i, ...patch } : i));
  const line = (patch: Partial<DraftBoundary>) =>
    props.onChange((i) => (i.kind === "boundary" ? { ...i, ...patch } : i));

  return (
    <MapDialog
      open
      onClose={props.onClose}
      title={title}
      description={!saved ? I.newBadge : props.changed ? I.changedBadge : undefined}
      closeLabel={ED.done}
      actions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locks.remove}
          onClick={props.onRemove}
          className="text-danger rounded-[var(--r-sm)]"
        >
          <Trash2 className="size-3.5" />
          {saved && item.kind !== "boundary" ? I.removeSaved : I.remove}
        </Button>
      }
    >
      {saved && item.kind !== "boundary" && (
        <p className="text-ink-tertiary text-xs">{I.removeSavedHint}</p>
      )}
      {saved && locks.identity && <Alert tone="warning">{I.noUpdate}</Alert>}
      <StockNotice stock={props.stock} />
      {item.kind === "shelf" && (
        <ShelfFields
          shelf={item}
          zones={props.zones}
          issues={props.issues}
          locks={locks}
          onPatch={shelf}
          onAddZone={props.onAddZone}
        />
      )}
      {item.kind === "area" && (
        <AreaFields area={item} issues={props.issues} locks={locks} onPatch={area} />
      )}
      {item.kind === "boundary" && (
        <BoundaryFields
          line={item}
          error={props.issues.line}
          disabled={locks.geometry}
          onPatch={line}
        />
      )}
    </MapDialog>
  );
}
