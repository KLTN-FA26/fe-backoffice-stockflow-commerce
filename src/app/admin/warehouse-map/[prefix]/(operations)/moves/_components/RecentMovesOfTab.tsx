"use client";

import { useWorkspaceWarehouse } from "@/lib/workspace";
import { RecentMoves } from "@/features/inventory";

/**
 * Lịch sử chuyển vị trí gần đây của kho trong tab (spec 2026-11-22 §5.8). Ghép ở tầng route vì `features/move` không
 * import `features/inventory`; file client riêng vì trang server không đọc được context kho của tab.
 */
export function RecentMovesOfTab() {
  return <RecentMoves warehouseId={useWorkspaceWarehouse().id} />;
}
