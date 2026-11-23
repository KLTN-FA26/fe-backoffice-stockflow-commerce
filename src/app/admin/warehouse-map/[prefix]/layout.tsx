import { WarehouseScope } from "@/features/warehouse-map/components/workspace/WarehouseScope";

import type { ReactNode } from "react";

/**
 * Mọi trang của một kho trong tab "Kho" (spec 2026-11-22 §5.2): tra prefix trên URL ra kho rồi cấp kho cho
 * trang con. Không kiểm kho được gán — bản đồ không giới hạn theo kho được gán (06); màn vận hành nằm trong `(operations)`.
 */
export default async function WarehouseWorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ prefix: string }>;
  children: ReactNode;
}) {
  const { prefix } = await params;
  return <WarehouseScope prefix={decodeURIComponent(prefix)}>{children}</WarehouseScope>;
}
