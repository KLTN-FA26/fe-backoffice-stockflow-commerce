"use client";

import { useWorkspaceWarehouse } from "@/lib/workspace";

import { RecentMoves } from "@/features/inventory";
import { MoveCreate } from "@/features/move";

/**
 * Danh sách các lần chuyển của kho trong tab (spec 2026-11-22 §5.8) + nút tạo lệnh di chuyển ở toolbar. Ghép ở tầng
 * route vì `features/move` và `features/inventory` không import nhau; file client riêng vì trang server không đọc được
 * context kho của tab.
 */
export function RecentMovesOfTab() {
  return <RecentMoves warehouseId={useWorkspaceWarehouse().id} actions={<MoveCreate />} />;
}
