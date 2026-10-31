"use client";

import { CircleHelp, Fullscreen, Hand, Maximize2, Minimize, ZoomIn, ZoomOut } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FloatingBar, FloatingDivider } from "./FloatingBar";
import { IconTool } from "./IconTool";

import type { ZoomControls } from "./use-pan-zoom";

const M = UI_LABELS.warehouseMap.map;

export interface MapControlsProps {
  /** Không có ở 3D (xoay / phóng bằng chuột trong cảnh). */
  zoom?: ZoomControls;
  fullscreen: { active: boolean; onToggle: () => void };
  /** Mở modal chú giải & số liệu. */
  onHelp?: () => void;
  /** Công cụ bàn tay (chế độ xem): bật thì kéo bản đồ không cần giữ Ctrl. */
  hand?: { active: boolean; onToggle: () => void };
}

/**
 * Thanh điều khiển dọc nổi bên phải bản đồ: phóng to, thu nhỏ, vừa khung · toàn màn hình · chú giải
 * ("?" mở modal — chú giải không chiếm chỗ trên trang).
 */
export function MapControls({ zoom, fullscreen, onHelp, hand }: MapControlsProps) {
  return (
    <TooltipProvider>
      <FloatingBar
        label={M.zoomGroup}
        orientation="vertical"
        className="top-1/2 right-3 -translate-y-1/2"
      >
        {hand && (
          <IconTool label={M.hand} side="left" pressed={hand.active} onClick={hand.onToggle}>
            <Hand className="size-3.5" />
          </IconTool>
        )}
        {zoom && (
          <>
            <IconTool label={M.zoomIn} side="left" disabled={!zoom.canIn} onClick={zoom.onIn}>
              <ZoomIn className="size-3.5" />
            </IconTool>
            <IconTool label={M.zoomOut} side="left" disabled={!zoom.canOut} onClick={zoom.onOut}>
              <ZoomOut className="size-3.5" />
            </IconTool>
            <IconTool
              label={M.zoomReset}
              side="left"
              disabled={!zoom.canOut}
              onClick={zoom.onReset}
            >
              <Maximize2 className="size-3.5" />
            </IconTool>
            <FloatingDivider vertical />
          </>
        )}
        <IconTool
          label={fullscreen.active ? M.exitFullscreen : M.fullscreen}
          side="left"
          pressed={fullscreen.active}
          onClick={fullscreen.onToggle}
        >
          {fullscreen.active ? (
            <Minimize className="size-3.5" />
          ) : (
            <Fullscreen className="size-3.5" />
          )}
        </IconTool>
        {onHelp && (
          <IconTool label={M.help} side="left" onClick={onHelp}>
            <CircleHelp className="size-3.5" />
          </IconTool>
        )}
      </FloatingBar>
    </TooltipProvider>
  );
}
