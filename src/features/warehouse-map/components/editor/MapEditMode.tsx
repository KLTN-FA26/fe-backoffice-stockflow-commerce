"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { Alert } from "@/components/shared/Alert";

import { MapControls } from "../shared/MapControls";
import { MapFrame } from "../shared/MapFrame";
import { usePanZoom } from "../shared/use-pan-zoom";
import { ViewToggle } from "../shared/ViewToggle";
import { EditActionsBar } from "./EditActionsBar";
import { EditDialogs } from "./EditDialogs";
import { EditPreview3D } from "./EditPreview3D";
import { FloatingTools } from "./FloatingTools";
import { useDraftSave } from "./use-draft-save";
import { useEditMode } from "./use-edit-mode";
import { useMapEditor } from "./use-map-editor";

import type { EditPermissions } from "@/features/warehouse-map/lifecycle";
import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapView } from "../map/useMapUrlState";

const ED = UI_LABELS.warehouseMap.edit;

// Konva chạy trên canvas của trình duyệt → chỉ tải ở client, tách khỏi bundle đầu trang
const EditorCanvas = dynamic(() => import("./canvas/EditorCanvas"), {
  ssr: false,
  loading: () => <div className="bg-bg-muted h-full animate-pulse rounded-(--card-radius)" />,
});

/**
 * Chế độ sửa bản đồ (docs 06 §4.1): vẽ kệ / khu vực / tường / cửa bằng kéo-thả trên canvas (thanh công
 * cụ và zoom nổi trên bản đồ), chỉnh thông số trong modal (bấm đúp / Enter), mọi thứ chỉ là bản nháp tới
 * khi bấm Lưu — lúc đó gửi tuần tự từng request. Thoát khi còn thay đổi thì hỏi lại. Nút 2D / 3D xem 3D
 * bản nháp chưa lưu (chỉ xem); khung 2D vẫn giữ nguyên bên dưới nên quay lại đúng chỗ đang sửa.
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
  const [view, setView] = useState<MapView>("2d");
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
  // Đang xem 3D: tắt phím sửa (Delete, Ctrl+Z…) — không tác động lên hình người dùng không thấy
  const mode = useEditMode(editor, save, zoomControls, onExit, view === "2d");

  return (
    <>
      {/* Thanh công cụ sửa + lỗi lưu đi theo khung: toàn màn hình thì vào trong khung, không bị che */}
      <MapFrame
        layout={layout}
        toolbar={
          <>
            <EditActionsBar
              tools={
                <div className="flex flex-wrap items-center gap-2">
                  <ViewToggle view={view} onChange={setView} />
                  {view === "2d" ? (
                    <FloatingTools
                      editor={editor}
                      onAddZone={() => mode.setZoneFor({ shelfKey: null })}
                      onInspect={() => mode.setInspecting(true)}
                    />
                  ) : (
                    <p role="note" className="text-ink-secondary text-xs">
                      {ED.preview3dNote}
                    </p>
                  )}
                </div>
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
            {view === "3d" && (
              <EditPreview3D layout={layout} draft={editor.draft} controls={controls} />
            )}
            <div
              ref={viewportRef}
              {...viewportBind}
              hidden={view === "3d"}
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
            {view === "2d" && <MapControls {...controls} zoom={zoomControls} />}
          </>
        )}
      </MapFrame>
      <EditDialogs layout={layout} editor={editor} mode={mode} onExit={onExit} />
    </>
  );
}
