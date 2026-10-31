"use client";

import { useState } from "react";
import { cn } from "cn";

import { MapHelpDialog } from "../map/MapHelpDialog";
import { useHotkeys } from "./use-hotkeys";
import { MAP_FULLSCREEN_FRAME_CLASS, useMapFullscreen } from "./use-map-fullscreen";

import type { ReactNode } from "react";
import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapControlsProps } from "./MapControls";

/**
 * Khung bản đồ dùng chung cho chế độ xem và sửa: card viền + bóng giãn lấp phần còn lại của trang
 * (`flex-1` trong `MAP_PAGE_CLASS`), bật được toàn màn hình, và modal
 * "?" (chú giải & số liệu). Nội dung nhận `controls` để gắn vào thanh điều khiển nổi của nó.
 */
export function MapFrame({
  layout,
  toolbar,
  children,
}: {
  layout: WarehouseLayout;
  /** Thanh công cụ của trang — nằm trên khung; toàn màn hình thì vào trong khung để không bị che. */
  toolbar?: ReactNode;
  children: (controls: Omit<MapControlsProps, "zoom">) => ReactNode;
}) {
  const fullscreen = useMapFullscreen();
  const [help, setHelp] = useState(false);
  // F / ? dùng chung cho chế độ xem và sửa (bảng: WAREHOUSE_MAP_SHORTCUTS)
  useHotkeys({ f: fullscreen.toggle, "?": () => setHelp(true) }, { enabled: !help });
  return (
    <>
      {!fullscreen.active && toolbar}
      <div
        data-fullscreen={fullscreen.active}
        className={cn(
          "group/map border-border-default bg-bg-surface flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-(--card-radius) border p-2 shadow-(--card-shadow)",
          fullscreen.active && MAP_FULLSCREEN_FRAME_CLASS,
        )}
      >
        {fullscreen.active && toolbar && <div className="shrink-0 space-y-2">{toolbar}</div>}
        <div className="relative min-h-0 flex-1">
          {children({
            fullscreen: { active: fullscreen.active, onToggle: fullscreen.toggle },
            onHelp: () => setHelp(true),
          })}
        </div>
      </div>
      {help && <MapHelpDialog layout={layout} onClose={() => setHelp(false)} />}
    </>
  );
}
