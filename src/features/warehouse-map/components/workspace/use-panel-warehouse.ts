"use client";

import { usePathname } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";
import { useAppStore } from "@/lib/store/use-app-store";

import {
  prefixFromPath,
  samePrefix,
  useWorkspaceWarehouses,
} from "@/features/warehouse-map/workspace";

/**
 * Kho của panel tab "Kho" — dùng chung cho dòng tiêu đề và danh sách trang. `urlPrefix`: prefix trên URL
 * (`/admin/warehouse-map/{prefix}/…`); không có thì kho mở gần nhất (nhớ trên máy) nếu còn trong danh mục — sang
 * Danh mục kho / Sức chứa kho panel KHÔNG văng về bước chọn kho. Kho bị xoá / gỡ quyền đọc → `prefix` null.
 */
export function usePanelWarehouse() {
  const pathname = usePathname();
  const urlPrefix = prefixFromPath(pathname, ADMIN_ROUTES.warehouseMap.root);
  const remembered = useAppStore((state) => state.workspacePrefix);
  const { warehouses } = useWorkspaceWarehouses();
  const find = (prefix: string) => warehouses?.find((w) => samePrefix(w.prefix, prefix));
  const prefix = urlPrefix ?? (remembered ? find(remembered)?.prefix : undefined) ?? null;
  return { pathname, urlPrefix, prefix, name: prefix ? find(prefix)?.name : undefined };
}
