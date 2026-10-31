"use client";

import { useRef, useState } from "react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { zoneColors } from "@/features/warehouse-map/selectors";

import { MapControls } from "../shared/MapControls";
import { fitScale, useElementSize } from "../shared/use-element-size";
import { useHotkeys } from "../shared/use-hotkeys";
import { usePanZoom } from "../shared/use-pan-zoom";
import { AreaShape, BoundaryLine } from "./AreaShapes";
import { MapFloor } from "./MapFloor";
import { ShelfShape } from "./ShelfShape";

import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapControlsProps } from "../shared/MapControls";

const M = UI_LABELS.warehouseMap.map;
/** Lề quanh khung (m) — đủ chỗ cho thước đo mét ở cạnh trên / trái và nét viền ngoài. */
const PAD = 1.4;

/**
 * Mặt bằng 2D (docs 06 §1): SVG `viewBox` theo mét, gốc (0, 0) ở góc trên-trái như BE `Footprint`.
 * Ctrl + lăn chuột để zoom quanh con trỏ; Ctrl + kéo, chuột giữa hoặc bàn tay (H) để dời bản đồ —
 * giống chế độ sửa; hoặc thanh điều khiển nổi bên phải / phím + − 0. Sửa bản đồ ở chế độ sửa (Konva).
 */
export function MapCanvas2D({
  layout,
  selectedId,
  onSelect,
  controls,
}: {
  layout: WarehouseLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Toàn màn hình + chú giải của thanh điều khiển nổi; zoom do bản đồ 2D tự giữ. */
  controls: Omit<MapControlsProps, "zoom">;
}) {
  const { mapWidth: width, mapHeight: height, name } = layout.warehouse;
  const colors = zoneColors(layout);
  // Ctrl + lăn: zoom quanh con trỏ; Ctrl + kéo / chuột giữa: dời bản đồ — như chế độ sửa
  // Bàn tay (H): bấm giữ kéo bản đồ không cần Ctrl
  const [hand, setHand] = useState(false);
  // Tách ngay giá trị của hook (có ref) — React Compiler coi `view.xxx` lúc render là đọc ref
  const { ref, bind, zoom, cursorClass, controls: zoomControls } = usePanZoom({ hand });
  // Zoom 1 = cả bản đồ nằm trọn trong khung (ngang lẫn dọc), không thanh cuộn
  const fitBox = useRef<HTMLDivElement>(null);
  const scale = fitScale(useElementSize(fitBox), { width, height }, PAD) * zoom;
  useHotkeys({
    "+": zoomControls.onIn,
    "=": zoomControls.onIn,
    "-": zoomControls.onOut,
    "0": zoomControls.onReset,
    h: () => setHand((on) => !on),
  });

  return (
    <div className="relative h-full">
      <div
        ref={ref}
        {...bind}
        className={cn(
          "bg-bg-surface h-full overflow-auto rounded-(--card-radius) p-2 select-none",
          cursorClass,
        )}
      >
        {/* Khung đo = cả vùng nhìn; SVG lớn hơn (zoom) thì tràn để khung cuộn ngoài kéo được, nhỏ hơn thì
            nằm giữa (margin auto trong flex — tràn thì tự về mép đầu, không bị cắt) */}
        <div ref={fitBox} className="flex h-full w-full">
          <svg
            role="group"
            aria-label={M.canvasLabel(name)}
            viewBox={`${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`}
            width={(width + 2 * PAD) * scale}
            height={(height + 2 * PAD) * scale}
            className="m-auto block shrink-0"
            onClick={(event) => {
              // Bấm vào nền (không phải kệ / khu vực) → bỏ chọn
              if (event.target === event.currentTarget) onSelect(null);
            }}
          >
            <MapFloor width={width} height={height} />
            {layout.areas.map((area) => (
              <AreaShape
                key={area.id}
                area={area}
                selected={area.id === selectedId}
                onSelect={() => onSelect(area.id)}
              />
            ))}
            {layout.shelves.map((shelf) => (
              <ShelfShape
                key={shelf.id}
                shelf={shelf}
                zoneColor={shelf.zoneId ? colors.get(shelf.zoneId) : undefined}
                selected={shelf.id === selectedId}
                onSelect={() => onSelect(shelf.id)}
              />
            ))}
            {layout.boundaries.map((boundary) => (
              <BoundaryLine key={boundary.id} boundary={boundary} />
            ))}
          </svg>
        </div>
      </div>
      <MapControls
        {...controls}
        zoom={zoomControls}
        hand={{ active: hand, onToggle: () => setHand((on) => !on) }}
      />
    </div>
  );
}
