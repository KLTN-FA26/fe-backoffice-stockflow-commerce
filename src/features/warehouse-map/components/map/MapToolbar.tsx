"use client";

import { Box, Eye, EyeOff, Grid2x2, PencilRuler } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import type { LucideIcon } from "lucide-react";
import type { MapUrlState, MapView } from "./useMapUrlState";

const M = UI_LABELS.warehouseMap.map;
const VIEWS: { view: MapView; label: string; icon: LucideIcon }[] = [
  { view: "2d", label: M.view2d, icon: Grid2x2 },
  { view: "3d", label: M.view3d, icon: Box },
];

const OUTLINE = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

/**
 * Hàng công cụ bản đồ (không khung, mỗi nút tự có viền — style Vercel): 2D / 3D, góc phải là nút vào
 * chế độ sửa (vẽ kéo-thả, lưu một lần). `canEdit` = có
 * `warehouse-locations:CREATE`; thiếu thì không render nút (UI-only, BE re-check).
 */
export function MapToolbar({
  url,
  canEdit,
  onEdit,
  inactive,
}: {
  url: MapUrlState;
  canEdit: boolean;
  onEdit: () => void;
  /** Số kệ / khu vực ngừng dùng — có thì hiện nút bật / tắt vẽ chúng. */
  inactive: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      {inactive > 0 && (
        <Button
          type="button"
          size="sm"
          aria-pressed={url.showInactive}
          onClick={url.toggleInactive}
          className={OUTLINE}
        >
          {url.showInactive ? (
            <Eye className="text-dot-info size-3.5" />
          ) : (
            <EyeOff className="text-ink-tertiary size-3.5" />
          )}
          {M.showInactive(inactive)}
        </Button>
      )}
      {canEdit && (
        <Button
          type="button"
          size="sm"
          onClick={onEdit}
          className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ml-auto`}
        >
          <PencilRuler className="size-3.5" /> {UI_LABELS.warehouseMap.edit.enter}
        </Button>
      )}
    </div>
  );
}
