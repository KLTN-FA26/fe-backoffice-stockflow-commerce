"use client";

import { useMemo, useState } from "react";

import { UI_LABELS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useWarehouseLayout } from "@/features/warehouse-map/queries";

import { Skeleton } from "@/components/ui/skeleton";

import { buildWalkGrid } from "../../walk-grid";
import { MapFrame } from "../shared/MapFrame";
import { MapCanvas2D } from "./MapCanvas2D";
import { RouteOverlay } from "./RouteOverlay";

import type { RouteMapPath } from "./RouteOverlay";

const R = UI_LABELS.warehouseMap.route;
/** Khung bản đồ cố định trong cột trái trang chi tiết (420px) — đủ thấy cả kho ở zoom vừa khung. */
const FRAME_CLASS = "flex h-105 flex-col";
const NOTE_CLASS = "text-ink-tertiary text-xs";

function Legend() {
  const item = (dot: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 ${dot}`} aria-hidden />
      {text}
    </span>
  );
  return (
    <div className={`${NOTE_CLASS} flex flex-wrap items-center gap-x-4 gap-y-1`}>
      {item("bg-ink-primary rounded-(--r-sm)", R.legendStart)}
      {item("bg-dot-info rounded-full", R.legendNext)}
      {item("bg-dot-positive rounded-full", R.legendDone)}
    </div>
  );
}

/**
 * Lộ trình chuyến cất trên Kho Map 2D (docs 05 §4.5 bước 14): mặt bằng chỉ xem + lớp đường nối điểm dừng. Cần
 * `warehouse-locations:READ` để đọc bản đồ — thiếu quyền / lỗi tải thì chỉ hiện một dòng, danh sách điểm dừng vẫn dùng
 * được. Dữ liệu điểm dừng nhận qua props (feature cất hàng tính), trang ghép hai feature.
 */
export function WarehouseRouteMap({
  warehouseId,
  path,
}: {
  warehouseId: string;
  path: RouteMapPath;
}) {
  const canRead = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const layout = useWarehouseLayout(warehouseId, canRead);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mặt bằng đi được dựng một lần cho mỗi bản layout (quét mọi ô × vật cản), dùng lại qua mọi lần vẽ lộ trình
  const grid = useMemo(() => (layout.data ? buildWalkGrid(layout.data) : null), [layout.data]);
  if (!canRead) return <p className={NOTE_CLASS}>{R.noRead}</p>;
  if (layout.isPending) return <Skeleton className="h-105 w-full rounded-(--card-radius)" />;
  if (!layout.data) return <p className={NOTE_CLASS}>{R.loadFailed}</p>;
  return (
    <section aria-label={R.label} className="space-y-2">
      <div className={FRAME_CLASS}>
        <MapFrame layout={layout.data}>
          {(controls) => (
            <MapCanvas2D
              layout={layout.data}
              selectedId={selectedId}
              onSelect={setSelectedId}
              controls={controls}
              overlay={
                <RouteOverlay
                  path={path}
                  grid={grid}
                  mapExtent={Math.max(
                    layout.data.warehouse.mapWidth,
                    layout.data.warehouse.mapHeight,
                  )}
                />
              }
            />
          )}
        </MapFrame>
      </div>
      <Legend />
      <p className={NOTE_CLASS}>{R.note}</p>
    </section>
  );
}
