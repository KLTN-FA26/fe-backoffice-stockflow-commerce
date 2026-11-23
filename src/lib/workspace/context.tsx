"use client";

import { createContext, useContext } from "react";

import { ADMIN_ROUTES } from "@/constants";

import type { ReactNode } from "react";

/**
 * Kho của tab làm việc theo kho (spec 2026-11-22 §5.2): layout `/admin/warehouse-map/[prefix]` tra prefix ra kho rồi cấp
 * qua context này. Feature (cất hàng, lấy hàng, kiểm kê…) đọc kho ở đây — không import `features/warehouse-map`.
 */
export interface WorkspaceWarehouse {
  id: string;
  prefix: string;
  name: string;
}

const WorkspaceWarehouseContext = createContext<WorkspaceWarehouse | null>(null);

export function WorkspaceWarehouseProvider({
  value,
  children,
}: {
  value: WorkspaceWarehouse;
  children: ReactNode;
}) {
  return (
    <WorkspaceWarehouseContext.Provider value={value}>
      {children}
    </WorkspaceWarehouseContext.Provider>
  );
}

/** Kho của tab. Ngoài provider là lỗi lập trình: màn vận hành không được chạy khi chưa có kho. */
export function useWorkspaceWarehouse(): WorkspaceWarehouse {
  const warehouse = useContext(WorkspaceWarehouseContext);
  if (!warehouse) throw new Error("useWorkspaceWarehouse ngoài WorkspaceWarehouseProvider");
  return warehouse;
}

/** Link trong tab theo prefix của kho đang làm việc — `path` lấy từ `WORKSPACE_PATHS`. */
export function useWorkspaceHref(): (path?: string) => string {
  const { prefix } = useWorkspaceWarehouse();
  return (path) => ADMIN_ROUTES.warehouseMap.page(prefix, path);
}

/**
 * Prefix kho của một mã vị trí: phần trước dấu `-` đầu tiên (06 BR-10: mã vị trí bắt đầu bằng prefix kho).
 * Cùng quy ước với `warehouseOf` của `features/move`.
 */
export function prefixOfLocation(code: string): string {
  const value = code.trim().toUpperCase();
  const dash = value.indexOf("-");
  return dash > 0 ? value.slice(0, dash) : value;
}

/** Bỏ `?warehouse=` của link cũ (kho giờ nằm trên đường dẫn), giữ nguyên thứ tự tham số còn lại. */
export function withoutWarehouseParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("warehouse");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
