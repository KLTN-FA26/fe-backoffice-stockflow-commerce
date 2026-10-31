"use client";

import { useMemo, useRef } from "react";

import {
  areaFocusPose,
  overviewPose,
  shelfFocusPose,
  stockByLocation,
} from "@/features/warehouse-map/cartons-3d";
import { useShelfStock, useWarehouseStock } from "@/features/warehouse-map/queries";
import { findPlace } from "@/features/warehouse-map/selectors";

import { useHotkeys } from "../../shared/use-hotkeys";

import type { CameraControlsImpl } from "@react-three/drei";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/**
 * Tiêu điểm của cảnh 3D: kệ / khu vực đang chọn, hàng trên kệ (tồn theo vị trí), đích camera, và nút /
 * phím điều khiển camera (+ − lại gần / ra xa, 0 toàn cảnh). Đích camera theo đúng object kệ / khu vực
 * nên hover hay render lại không làm camera bay lại.
 */
export function useSceneFocus(
  layout: WarehouseLayout,
  selectedId: string | null,
  onSelect: (id: string | null) => void,
) {
  const cameraRef = useRef<CameraControlsImpl>(null);
  const { id: warehouseId, prefix, mapWidth: w, mapHeight: h } = layout.warehouse;
  const place = findPlace(layout, selectedId);
  const shelf = place?.kind === "shelf" ? place.shelf : null;
  const area = place?.kind === "area" ? place.area : null;

  const stockQuery = useShelfStock(
    shelf ? { warehouseId, locationCode: `${prefix}-${shelf.code}` } : null,
  );
  const rows = stockQuery.data;
  const stock = useMemo(() => stockByLocation(rows ?? []), [rows]);
  const stocked = useMemo(() => new Set(stock.keys()), [stock]);
  // Toàn cảnh: tồn cả kho (một lần đọc theo trang) → thùng ở mọi bin có hàng, bin trống để trống
  const warehouseQuery = useWarehouseStock(layout.warehouse);
  const warehouse = warehouseQuery.data;
  const allStock = useMemo(() => stockByLocation(warehouse?.rows ?? []), [warehouse]);
  const allStocked = useMemo(() => new Set(allStock.keys()), [allStock]);
  const overview = useMemo(() => overviewPose(w, h), [w, h]);
  const pose = useMemo(
    () => (shelf ? shelfFocusPose(shelf) : area ? areaFocusPose(area) : null),
    [shelf, area],
  );

  // Đang xem một vị trí → "toàn cảnh" = bỏ chọn (camera tự bay về); không thì đặt lại góc nhìn
  const toOverview = () =>
    place
      ? onSelect(null)
      : void cameraRef.current?.setLookAt(...overview.position, ...overview.target, true);
  const dolly = (ratio: number) => {
    const camera = cameraRef.current;
    if (camera) void camera.dolly(camera.distance * ratio, true);
  };
  const zoom = {
    canIn: true,
    canOut: true,
    onIn: () => dolly(0.3),
    onOut: () => dolly(-0.45),
    onReset: toOverview,
  };
  useHotkeys({ "+": zoom.onIn, "=": zoom.onIn, "-": zoom.onOut, "0": toOverview });

  return {
    cameraRef,
    shelf,
    area,
    stock,
    stockState: { rows: rows ?? [], isLoading: stockQuery.isLoading, isError: stockQuery.isError },
    stocked,
    overviewStock: {
      stock: allStock,
      stocked: allStocked,
      /** Kho lớn hơn trần đọc → chỉ vẽ một phần, UI phải báo. */
      partial: warehouse?.truncated
        ? { shown: warehouse.rows.length, total: warehouse.total }
        : null,
      failed: warehouseQuery.isError,
    },
    overview,
    pose,
    zoom,
    toOverview,
  };
}
