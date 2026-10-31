"use client";

import dynamic from "next/dynamic";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { MapControls } from "../shared/MapControls";
import { MapFrame } from "../shared/MapFrame";
import { usePanZoom } from "../shared/use-pan-zoom";
import { EditActionsBar } from "./EditActionsBar";
import { FloatingTools } from "./FloatingTools";
import { Inspector } from "./inspector/Inspector";
import { useDraftSave } from "./use-draft-save";
import { useEditMode } from "./use-edit-mode";
import { useMapEditor } from "./use-map-editor";
import { ZoneDialog } from "./ZoneDialog";

import type { EditPermissions } from "@/features/warehouse-map/lifecycle";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

const ED = UI_LABELS.warehouseMap.edit;

// Konva chạy trên canvas của trình duyệt → chỉ tải ở client, tách khỏi bundle đầu trang
const EditorCanvas = dynamic(() => import("./canvas/EditorCanvas"), {
  ssr: false,
  loading: () => <div className="bg-bg-muted h-full animate-pulse rounded-(--card-radius)" />,
});

/**
 * Chế độ sửa bản đồ (docs 06 §4.1): vẽ kệ / khu vực / tường / cửa bằng kéo-thả trên canvas (thanh công
 * cụ và zoom nổi trên bản đồ), chỉnh thông số trong modal (bấm đúp / Enter), mọi thứ chỉ là bản nháp tới
 * khi bấm Lưu — lúc đó gửi tuần tự từng request. Thoát khi còn thay đổi thì hỏi lại.
 */
export function MapEditMode({
  layout,
  can,
  onExit,
}: {
  layout: WarehouseLayout;
  can: EditPermissions;
  onExit: () => void;
}) {
  const editor = useMapEditor(layout, can);
  const save = useDraftSave(editor, layout.warehouse.id, onExit);
  // Ctrl + lăn: zoom; Ctrl + kéo / chuột giữa: dời bản đồ — giống chế độ xem (kéo thường để vẽ / dời hình)
  // Tách ngay giá trị của hook (có ref) — React Compiler coi `view.xxx` lúc render là đọc ref
  const {
    ref: viewportRef,
    bind: viewportBind,
    zoom,
    panMode,
    cursorClass,
    controls: zoomControls,
  } = usePanZoom({ hand: editor.tool === "pan" });
  const mode = useEditMode(editor, save, zoomControls, onExit);
  const { selection } = mode;

  return (
    <>
      {/* Thanh công cụ sửa + lỗi lưu đi theo khung: toàn màn hình thì vào trong khung, không bị che */}
      <MapFrame
        layout={layout}
        toolbar={
          <>
            <EditActionsBar
              tools={
                <FloatingTools
                  editor={editor}
                  onAddZone={() => mode.setZoneFor({ shelfKey: null })}
                  onInspect={() => mode.setInspecting(true)}
                />
              }
              changes={editor.changes}
              invalid={editor.issues.size}
              progress={save.progress}
              onExit={mode.exit}
              onSave={save.run}
            />
            {save.error && <Alert tone="danger">{save.error}</Alert>}
          </>
        }
      >
        {(controls) => (
          <>
            <div
              ref={viewportRef}
              {...viewportBind}
              data-testid="map-edit-viewport"
              className={cn("h-full overflow-auto", cursorClass)}
              // Bấm vào khoảng trống quanh bản đồ (ngoài canvas) cũng bỏ chọn — canvas không nhận được
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) editor.select(null);
              }}
            >
              <EditorCanvas
                layout={layout}
                draft={editor.draft}
                tool={editor.tool}
                zoom={zoom}
                interactive={!panMode}
                selectedKeys={editor.selectedKeys}
                isEditable={editor.isEditable}
                isChanged={editor.isChanged}
                invalidKeys={new Set(editor.issues.keys())}
                onSelect={editor.select}
                onSelectMany={editor.selectMany}
                onToggle={editor.toggle}
                onOpen={(key) => {
                  editor.select(key);
                  mode.setInspecting(true);
                }}
                onDraw={editor.draw}
                onChange={editor.change}
                onBlockedMove={editor.warnBlockedMove}
              />
            </div>
            <MapControls {...controls} zoom={zoomControls} />
          </>
        )}
      </MapFrame>
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
