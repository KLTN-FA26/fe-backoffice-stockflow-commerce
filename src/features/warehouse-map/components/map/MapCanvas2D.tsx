"use client";

import { useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { zoneColors } from "@/features/warehouse-map/selectors";

import { AreaShape, BoundaryLine } from "./AreaShapes";
import { LINE } from "./shape-utils";
import { ShelfShape } from "./ShelfShape";
import { ZoomButton } from "./ZoomButton";

import type { WarehouseLayout } from "@/features/warehouse-map/types";

const M = UI_LABELS.warehouseMap.map;
const ZOOMS = [1, 1.5, 2, 3, 4] as const;
/** Lề quanh khung (m) để nét viền và nhãn mép không bị cắt. */
const PAD = 1;

const range = (extent: number, step: number) =>
  Array.from({ length: Math.floor(extent / step) }, (_, i) => (i + 1) * step);

/**
 * Mặt bằng 2D (docs 06 §1): SVG `viewBox` theo mét, gốc (0, 0) ở góc trên-trái như BE `Footprint`.
 * Phóng to bằng nút (khung cuộn để kéo xem) — không kéo-thả sửa ở giai đoạn này.
 */
export function MapCanvas2D({
  layout,
  selectedId,
  onSelect,
}: {
  layout: WarehouseLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const { mapWidth: width, mapHeight: height, name } = layout.warehouse;
  const colors = zoneColors(layout);
  const zoom = ZOOMS[zoomIndex] ?? 1;

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <ZoomButton
          label={M.zoomOut}
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((i) => i - 1)}
        >
          <ZoomOut className="size-3.5" />
        </ZoomButton>
        <ZoomButton label={M.zoomReset} disabled={zoomIndex === 0} onClick={() => setZoomIndex(0)}>
          <Maximize2 className="size-3.5" />
        </ZoomButton>
        <ZoomButton
          label={M.zoomIn}
          disabled={zoomIndex === ZOOMS.length - 1}
          onClick={() => setZoomIndex((i) => i + 1)}
        >
          <ZoomIn className="size-3.5" />
        </ZoomButton>
      </div>
      <div className="bg-bg-surface max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-auto rounded-(--card-radius)">
        <svg
          role="group"
          aria-label={M.canvasLabel(name)}
          viewBox={`${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`}
          style={{ width: `${zoom * 100}%` }}
          className="block h-auto"
          onClick={(event) => {
            // Bấm vào nền (không phải kệ / khu vực) → bỏ chọn
            if (event.target === event.currentTarget) onSelect(null);
          }}
        >
          {range(width, LIMITS.gridMinor).map((x) => (
            <line
              key={`gx${x}`}
              x1={x}
              x2={x}
              y1={0}
              y2={height}
              className="stroke-border-default pointer-events-none"
              strokeWidth={x % LIMITS.gridMajor === 0 ? LINE.thin * 1.5 : LINE.thin / 2}
            />
          ))}
          {range(height, LIMITS.gridMinor).map((y) => (
            <line
              key={`gy${y}`}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              className="stroke-border-default pointer-events-none"
              strokeWidth={y % LIMITS.gridMajor === 0 ? LINE.thin * 1.5 : LINE.thin / 2}
            />
          ))}
          <rect
            width={width}
            height={height}
            className="stroke-border-strong pointer-events-none fill-none"
            strokeWidth={LINE.base}
          />
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
  );
}
