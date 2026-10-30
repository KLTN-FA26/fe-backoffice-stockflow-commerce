"use client";

import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  DoorOpen,
  Hand,
  Minus,
  MousePointer2,
  Redo2,
  RotateCw,
  SlidersHorizontal,
  Square,
  SquareDashed,
  Tags,
  Trash2,
  Undo2,
} from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FloatingBar, FloatingDivider } from "../shared/FloatingBar";
import { IconTool } from "../shared/IconTool";

import type { LucideIcon } from "lucide-react";
import type { DraftTool } from "@/features/warehouse-map/draft-edit";
import type { MapEditor } from "./use-map-editor";

const ED = UI_LABELS.warehouseMap.edit;

const TOOLS: { tool: DraftTool; label: string; icon: LucideIcon }[] = [
  { tool: "select", label: ED.tool.select, icon: MousePointer2 },
  { tool: "pan", label: ED.tool.pan, icon: Hand },
  { tool: "shelf", label: ED.tool.shelf, icon: Square },
  { tool: "area", label: ED.tool.area, icon: SquareDashed },
  { tool: "wall", label: ED.tool.wall, icon: Minus },
  { tool: "door", label: ED.tool.door, icon: DoorOpen },
];

export interface FloatingToolsProps {
  editor: MapEditor;
  onAddZone: () => void;
  onInspect: () => void;
}

/**
 * Thanh công cụ sửa ở hàng trên bản đồ, cạnh Thoát / Lưu (zoom / toàn màn hình / "?" ở thanh dọc bên phải):
 * công cụ chọn / vẽ, thêm zone, hoàn tác / làm lại, dán; đang chọn một hình thì thêm Thông số · Sao chép ·
 * Nhân bản · Xoay · Xoá. Tooltip ghi kèm phím tắt.
 */
export function FloatingTools({ editor, onAddZone, onInspect }: FloatingToolsProps) {
  const selection =
    editor.selected && editor.locks
      ? { locks: editor.locks, rotatable: editor.selected.kind !== "boundary" }
      : null;
  return (
    <TooltipProvider>
      <FloatingBar label={ED.toolbar} inline>
        <div role="group" aria-label={ED.toolGroup} className="flex gap-1">
          {TOOLS.map(({ tool, label, icon: Icon }) => (
            <IconTool
              key={tool}
              label={label}
              pressed={editor.tool === tool}
              onClick={() => editor.setTool(tool)}
            >
              <Icon className="size-3.5" />
            </IconTool>
          ))}
        </div>
        <FloatingDivider />
        <div role="group" aria-label={ED.editGroup} className="flex gap-1">
          <IconTool label={ED.addZone} onClick={onAddZone}>
            <Tags className="text-dot-info size-3.5" />
          </IconTool>
          <IconTool label={ED.undo} disabled={!editor.canUndo} onClick={editor.undo}>
            <Undo2 className="size-3.5" />
          </IconTool>
          <IconTool label={ED.redo} disabled={!editor.canRedo} onClick={editor.redo}>
            <Redo2 className="size-3.5" />
          </IconTool>
          <IconTool label={ED.paste} disabled={!editor.canPaste} onClick={editor.paste}>
            <ClipboardPaste className="size-3.5" />
          </IconTool>
        </div>
        {selection && (
          <>
            <FloatingDivider />
            <div role="group" aria-label={ED.selectionGroup} className="flex gap-1">
              <IconTool label={ED.inspect} onClick={onInspect}>
                <SlidersHorizontal className="size-3.5" />
              </IconTool>
              <IconTool label={ED.copy} onClick={editor.copy}>
                <Copy className="size-3.5" />
              </IconTool>
              <IconTool label={ED.duplicate} onClick={editor.duplicate}>
                <CopyPlus className="size-3.5" />
              </IconTool>
              <IconTool
                label={ED.rotate}
                disabled={!selection.rotatable || selection.locks.geometry}
                onClick={editor.rotate}
              >
                <RotateCw className="size-3.5" />
              </IconTool>
              <IconTool
                label={ED.remove}
                danger
                disabled={selection.locks.remove}
                onClick={editor.remove}
              >
                <Trash2 className="size-3.5" />
              </IconTool>
            </div>
          </>
        )}
      </FloatingBar>
    </TooltipProvider>
  );
}
