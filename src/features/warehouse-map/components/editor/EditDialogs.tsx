"use client";

import { UI_LABELS } from "@/constants";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { Inspector } from "./inspector/Inspector";
import { ZoneDialog } from "./ZoneDialog";

import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { useEditMode } from "./use-edit-mode";
import type { MapEditor } from "./use-map-editor";

const ED = UI_LABELS.warehouseMap.edit;

/** Các modal của chế độ sửa: thông số hình đang chọn, thêm zone, xác nhận thoát khi còn thay đổi. */
export function EditDialogs({
  layout,
  editor,
  mode,
  onExit,
}: {
  layout: WarehouseLayout;
  editor: MapEditor;
  mode: ReturnType<typeof useEditMode>;
  onExit: () => void;
}) {
  const { selection } = mode;
  return (
    <>
      {mode.inspecting && selection && (
        <Inspector
          key={selection.item.key}
          item={selection.item}
          zones={editor.draft.zones}
          issues={editor.issues.get(selection.item.key) ?? {}}
          stock={editor.stock}
          locks={selection.locks}
          changed={editor.isChanged(selection.item)}
          onChange={(apply) =>
            editor.change(selection.item.key, apply, `inspect:${selection.item.key}`)
          }
          onRemove={() => {
            editor.remove();
            mode.setInspecting(false);
          }}
          onAddZone={() => mode.setZoneFor({ shelfKey: selection.item.key })}
          onClose={() => mode.setInspecting(false)}
        />
      )}
      {mode.zoneFor && (
        <ZoneDialog
          warehouseName={layout.warehouse.name}
          existingNames={editor.draft.zones.map((zone) => zone.name)}
          onAdd={(zone) => mode.addZone(zone.name, zone.color)}
          onClose={() => mode.setZoneFor(null)}
        />
      )}
      <ConfirmDialog
        open={mode.confirmExit}
        onOpenChange={mode.setConfirmExit}
        title={ED.exitTitle}
        description={ED.exitDescription(editor.changes)}
        confirmLabel={ED.exitConfirm}
        cancelLabel={ED.exitKeep}
        onConfirm={onExit}
      />
    </>
  );
}
