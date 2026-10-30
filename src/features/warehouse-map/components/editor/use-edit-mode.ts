"use client";

import { useState } from "react";

import { newKeyOf } from "@/features/warehouse-map/draft-edit";

import { useEditorKeys } from "./use-editor-keys";

import type { ZoomControls } from "../shared/use-pan-zoom";
import type { useDraftSave } from "./use-draft-save";
import type { MapEditor } from "./use-map-editor";

/**
 * State màn của chế độ sửa (ngoài bản nháp): dialog thông số / thêm zone / xác nhận thoát, và gắn phím
 * tắt (zoom qua `ZoomControls` của khung bản đồ) — phím đơn tắt khi có dialog mở hoặc đang lưu.
 */
export function useEditMode(
  editor: MapEditor,
  save: ReturnType<typeof useDraftSave>,
  zoom: ZoomControls,
  onExit: () => void,
) {
  /** Dialog thêm zone; mở từ bảng thông số kệ thì zone mới gán luôn cho kệ đó. */
  const [zoneFor, setZoneFor] = useState<{ shelfKey: string | null } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  /** Modal thông số của hình đang chọn — đóng tự nhiên khi hình bị xoá / bỏ chọn. */
  const [inspecting, setInspecting] = useState(false);
  const selection =
    editor.selected && editor.locks ? { item: editor.selected, locks: editor.locks } : null;
  const idle = save.progress === null;

  useEditorKeys(
    editor,
    {
      inspect: () => setInspecting(selection !== null),
      addZone: () => setZoneFor({ shelfKey: null }),
      save: save.run,
      zoom: (step) => (step === 0 ? zoom.onReset() : step === 1 ? zoom.onIn() : zoom.onOut()),
    },
    {
      enabled: zoneFor === null && !confirmExit && !inspecting && idle,
      // Ctrl+S chỉ lưu khi nút Lưu bấm được: có thay đổi, không hình nào sai luật
      canSave: idle && !confirmExit && editor.changes > 0 && editor.issues.size === 0,
    },
  );

  return {
    selection,
    zoneFor,
    setZoneFor,
    confirmExit,
    setConfirmExit,
    inspecting,
    setInspecting,
    exit: () => (save.dirty ? setConfirmExit(true) : onExit()),
    addZone: (name: string, color: string | null) => {
      const key = newKeyOf(editor.draft);
      editor.dispatch({ type: "addZone", name, color });
      if (zoneFor?.shelfKey)
        editor.change(zoneFor.shelfKey, (item) =>
          item.kind === "shelf" ? { ...item, zoneKey: key } : item,
        );
    },
  };
}
