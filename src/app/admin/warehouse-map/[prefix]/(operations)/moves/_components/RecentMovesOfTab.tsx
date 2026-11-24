"use client";

import { useWorkspaceWarehouse } from "@/lib/workspace";

import { RecentMoves } from "@/features/inventory";
import { MoveCreate } from "@/features/move";
import { LocationPickMap } from "@/features/warehouse-map/components/map/LocationPickMap";

import type { DestinationMapProps } from "@/features/move";

/**
 * Danh sách các lần chuyển của kho trong tab (spec 2026-11-22 §5.8) + nút tạo lệnh di chuyển ở toolbar. Ghép ở tầng
 * route vì `features/move`, `features/inventory` và `features/warehouse-map` không import nhau: bản đồ kho 2D vào modal
 * chuyển thùng để tô nơi thùng đang nằm và chọn vị trí đích (docs 11 §4.1 bước 1–2). File client riêng vì trang server
 * không đọc được context kho của tab và không truyền được hàm render.
 */
export function RecentMovesOfTab() {
  const warehouseId = useWorkspaceWarehouse().id;
  const destinationMap = (props: DestinationMapProps) => (
    <LocationPickMap warehouseId={warehouseId} {...props} />
  );
  return (
    <RecentMoves
      warehouseId={warehouseId}
      actions={<MoveCreate destinationMap={destinationMap} />}
    />
  );
}
