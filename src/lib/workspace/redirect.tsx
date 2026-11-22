"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useWorkspaceWarehouse, withoutWarehouseParam } from "./context";

import type { ReactNode } from "react";

/**
 * Trang của route cũ (`/admin/putaway`, `/admin/picking/{id}`…) chuyển sang route trong tab theo kho (spec §5.5).
 * Có `prefix` thì dùng luôn; không thì tra `warehouseId` ra prefix qua danh mục kho. Tra không được (thiếu id, kho
 * không có trong danh mục, danh mục lỗi) → về gốc tab để chọn kho, không treo màn chờ.
 */
export function WorkspaceRedirect({
  warehouseId,
  prefix,
  path,
  keepQuery = false,
}: {
  warehouseId?: string | null;
  prefix?: string | null;
  path?: string;
  keepQuery?: boolean;
}) {
  const router = useRouter();
  const directory = useWarehouseDirectory(!prefix && Boolean(warehouseId));
  const resolved =
    prefix ||
    directory.data?.find((warehouse) => warehouse.warehouseId === warehouseId)?.code ||
    null;
  const failed = !resolved && (!warehouseId || directory.isError || directory.data !== undefined);
  const target = resolved
    ? ADMIN_ROUTES.warehouseMap.page(resolved, path) +
      (keepQuery ? withoutWarehouseParam(window.location.search) : "")
    : failed
      ? ADMIN_ROUTES.warehouseMap.root
      : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  return <PageSkeleton variant="list" />;
}

/**
 * Trang chi tiết trong tab theo kho: bản ghi thuộc kho khác kho trên URL (link dán tay, sửa tay) → không hiện bản ghi
 * dưới kho sai, chuyển sang đúng kho của bản ghi (spec 2026-11-22 §2: màn trong tab không làm việc với kho khác).
 * Bản ghi không có kho → hiện bình thường. UI-only — Backend phải re-check (WarehouseScope).
 */
export function InWorkspaceWarehouse({
  warehouseId,
  path,
  children,
}: {
  warehouseId: string | null | undefined;
  /** Đường dẫn của chính bản ghi trong tab (`WORKSPACE_PATHS.*`). */
  path: string;
  children: ReactNode;
}) {
  const workspace = useWorkspaceWarehouse();
  if (warehouseId && warehouseId !== workspace.id)
    return <WorkspaceRedirect warehouseId={warehouseId} path={path} />;
  return children;
}
