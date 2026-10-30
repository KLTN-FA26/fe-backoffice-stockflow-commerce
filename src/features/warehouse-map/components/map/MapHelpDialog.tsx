"use client";

import { UI_LABELS, WAREHOUSE_MAP_SHORTCUTS } from "@/constants";

import { MapDialog } from "../shared/MapDialog";
import { MapLegend } from "./MapLegend";
import { ShortcutList } from "./ShortcutList";

import type { WarehouseLayout } from "@/features/warehouse-map/types";

const M = UI_LABELS.warehouseMap.map;

/**
 * Modal "?" của bản đồ: số liệu, chú giải màu, cách thao tác, nhãn BR-05 (bản đồ chỉ mang tính trực
 * quan) và bảng phím tắt — gom vào đây để trang không tốn chỗ cho các dòng giải thích.
 */
export function MapHelpDialog({
  layout,
  onClose,
}: {
  layout: WarehouseLayout;
  onClose: () => void;
}) {
  return (
    <MapDialog
      open
      onClose={onClose}
      title={M.helpTitle}
      closeLabel={UI_LABELS.warehouseMap.panel.close}
    >
      <MapLegend layout={layout} />
      <p className="text-ink-secondary text-xs">{M.clickHint}</p>
      <p className="text-ink-tertiary text-xs">{M.disclaimer}</p>
      <ShortcutList title={M.shortcutsView} shortcuts={WAREHOUSE_MAP_SHORTCUTS.view} />
      <ShortcutList title={M.shortcutsEdit} shortcuts={WAREHOUSE_MAP_SHORTCUTS.edit} />
    </MapDialog>
  );
}
