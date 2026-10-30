"use client";

import { useWatch } from "react-hook-form";

import { UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { exampleBinCode } from "@/features/warehouse-map/selectors";

import type { Control } from "react-hook-form";
import type { WarehouseCreateBody, WarehouseCreateInput } from "@/features/warehouse-map/types";

const F = UI_LABELS.warehouseMap.form;

const parse = (raw: string) => {
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Xem trước khung bản đồ đúng tỉ lệ rộng × dài, lưới 5 m, gốc (0, 0) ở góc trên-trái (docs 06 §4.1),
 * và ví dụ mã bin với prefix đang nhập (BR-10) — để người tạo kho thấy ngay prefix nằm ở đâu.
 */
export function MapFramePreview({
  control,
}: {
  control: Control<WarehouseCreateInput, unknown, WarehouseCreateBody>;
}) {
  const [rawWidth, rawHeight, prefix] = useWatch({
    control,
    name: ["mapWidth", "mapHeight", "prefix"],
  });
  const width = parse(rawWidth);
  const height = parse(rawHeight);
  const grid = (extent: number) =>
    Array.from(
      { length: Math.floor(extent / LIMITS.gridMajor) },
      (_, i) => (i + 1) * LIMITS.gridMajor,
    );

  return (
    <div className="border-border-default bg-bg-subtle space-y-2 rounded-(--card-radius) border p-3">
      <p className="text-ink-secondary text-xs font-medium">{F.previewTitle}</p>
      {width && height ? (
        <svg
          viewBox={`-1 -1 ${width + 2} ${height + 2}`}
          className="bg-bg-surface aspect-[4/3] w-full rounded-(--r-sm)"
          role="img"
          aria-label={`${F.previewTitle}: ${formatNumber(width)} × ${formatNumber(height)} m`}
          preserveAspectRatio="xMidYMid meet"
        >
          {grid(width).map((x) => (
            <line
              key={`x${x}`}
              x1={x}
              x2={x}
              y1={0}
              y2={height}
              className="stroke-border-default"
              strokeWidth={0.08}
            />
          ))}
          {grid(height).map((y) => (
            <line
              key={`y${y}`}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              className="stroke-border-default"
              strokeWidth={0.08}
            />
          ))}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="none"
            className="stroke-ink-primary"
            strokeWidth={0.2}
          />
          <circle cx={0} cy={0} r={0.5} className="fill-dot-info" />
        </svg>
      ) : (
        <p className="text-ink-tertiary text-xs">{F.previewEmpty}</p>
      )}
      <p className="text-ink-secondary text-xs">
        {F.locationExample}:{" "}
        <span className="text-ink-primary font-[family-name:var(--font-mono)]">
          {exampleBinCode(prefix)}
        </span>
      </p>
    </div>
  );
}
