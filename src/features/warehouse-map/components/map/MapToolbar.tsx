"use client";

import { Eye, EyeOff, PencilRuler, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { ViewToggle } from "../shared/ViewToggle";

import type { MapUrlState } from "./useMapUrlState";

const M = UI_LABELS.warehouseMap.map;

const OUTLINE = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

/**
 * Hàng công cụ bản đồ (không khung, mỗi nút tự có viền — style Vercel): 2D / 3D, góc phải là nút in nhãn vị trí
 * (docs 06 §4.3 — ai xem được bản đồ đều in được) và nút vào chế độ sửa (vẽ kéo-thả, lưu một lần). `canEdit` = có
 * `warehouse-locations:CREATE`; thiếu thì không render nút (UI-only, BE re-check).
 */
export function MapToolbar({
  url,
  canEdit,
  onEdit,
  onPrintLabels,
  inactive,
}: {
  url: MapUrlState;
  canEdit: boolean;
  onEdit: () => void;
  /** Có bố cục thì mở dialog in nhãn; chưa tải xong thì không render nút. */
  onPrintLabels?: () => void;
  /** Số kệ / khu vực ngừng dùng — có thì hiện nút bật / tắt vẽ chúng. */
  inactive: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ViewToggle view={url.view} onChange={url.setView} />
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
      <div className="ml-auto flex gap-2">
        {onPrintLabels && (
          <Button type="button" size="sm" onClick={onPrintLabels} className={OUTLINE}>
            <Printer className="text-dot-info size-3.5" /> {UI_LABELS.warehouseMap.print.open}
          </Button>
        )}
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={onEdit}
            className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
          >
            <PencilRuler className="size-3.5" /> {UI_LABELS.warehouseMap.edit.enter}
          </Button>
        )}
      </div>
    </div>
  );
}
