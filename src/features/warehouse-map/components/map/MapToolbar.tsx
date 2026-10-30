"use client";

import { Box, DoorOpen, Grid2x2, Layers, Plus, Square, Tags } from "lucide-react";

import { PAGE_SIZE, UI_LABELS } from "@/constants";

import { useWarehouses } from "@/features/warehouse-map/queries";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { LucideIcon } from "lucide-react";
import type { MapUrlState, MapView } from "./useMapUrlState";

const M = UI_LABELS.warehouseMap.map;
const A = UI_LABELS.warehouseMap.actions;

export type EditorKind = "zone" | "shelf" | "area" | "boundary";

const EDITORS: { kind: EditorKind; label: string; icon: LucideIcon }[] = [
  { kind: "boundary", label: A.addBoundary, icon: DoorOpen },
  { kind: "area", label: A.addArea, icon: Square },
  { kind: "zone", label: A.addZone, icon: Tags },
  { kind: "shelf", label: A.addShelf, icon: Plus },
];
const VIEWS: { view: MapView; label: string; icon: LucideIcon }[] = [
  { view: "2d", label: M.view2d, icon: Grid2x2 },
  { view: "3d", label: M.view3d, icon: Box },
];

const OUTLINE = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

/**
 * Hàng công cụ bản đồ (không khung, mỗi nút tự có viền — style Vercel): chọn kho, 2D / 3D, rồi các nút
 * vẽ bản đồ ở góc phải theo thứ tự docs 06 §4.1 (tường bao → khu vực → zone → kệ). `canEdit` = có
 * `warehouse-locations:CREATE`; thiếu thì không render nút vẽ (UI-only, BE re-check).
 */
export function MapToolbar({
  url,
  canEdit,
  onEdit,
}: {
  url: MapUrlState;
  canEdit: boolean;
  onEdit: (kind: EditorKind) => void;
}) {
  const warehouses = useWarehouses({ page: 0, size: PAGE_SIZE.masterData });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={url.warehouseId ?? ""} onValueChange={url.setWarehouseId}>
        <SelectTrigger
          aria-label={M.selectWarehouse}
          className={`${FORM_SELECT_CLASS} h-(--control-h) w-72`}
        >
          <Layers className="text-dot-info size-3.5" />
          <SelectValue placeholder={M.selectWarehouse} />
        </SelectTrigger>
        <TitledSelectContent title={M.selectWarehouse}>
          {(warehouses.data?.items ?? []).map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              <span className="font-[family-name:var(--font-mono)]">{warehouse.prefix}</span> ·{" "}
              {warehouse.name}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
      <div role="group" aria-label={M.viewToggle} className="flex gap-1">
        {VIEWS.map(({ view, label, icon: Icon }) => (
          <Button
            key={view}
            type="button"
            size="sm"
            aria-pressed={url.view === view}
            onClick={() => url.setView(view)}
            className={
              url.view === view
                ? `${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover`
                : OUTLINE
            }
          >
            <Icon className="size-3.5" /> {label}
          </Button>
        ))}
      </div>
      {canEdit && url.warehouseId && (
        <div className="ml-auto flex flex-wrap gap-2">
          {EDITORS.map(({ kind, label, icon: Icon }) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              onClick={() => onEdit(kind)}
              className={
                kind === "shelf"
                  ? `${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`
                  : OUTLINE
              }
            >
              <Icon className={kind === "shelf" ? "size-3.5" : "text-dot-info size-3.5"} /> {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
