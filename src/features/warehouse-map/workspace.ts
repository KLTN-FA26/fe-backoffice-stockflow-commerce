"use client";

/**
 * Tab "Kho & bản đồ": trang làm việc theo một kho nằm dưới prefix kho trên URL
 * (`/admin/warehouse-map/{prefix}`) — prefix duy nhất toàn hệ thống và không đổi (BR-10 / BR-13) nên
 * link luôn đúng. BE chỉ đọc kho theo id → đổi prefix ra kho qua danh mục kho (đã cache cho bước chọn).
 * Kho dùng gần nhất nhớ trên máy này để tô sẵn ở bước chọn kho. KHÔNG gắn `X-Warehouse-Id` cho cả app.
 */

import { ADMIN_ROUTES, PAGE_SIZE, WAREHOUSE_PERMISSIONS } from "@/constants";
import { useCan, useMyPermissions } from "@/lib/auth";

import { useWarehouses } from "./queries";

/** Danh mục kho cho ô đổi kho / tên kho trên breadcrumb — cần `warehouse-warehouses:READ` (BE re-check). */
export function useWorkspaceWarehouses() {
  const canRead = useCan(WAREHOUSE_PERMISSIONS.read);
  // `useCan` là false khi quyền còn đang tải — phân biệt để không nháy "chưa được cấp quyền" mỗi lần tải lại trang
  const permissionsPending = useMyPermissions().isPending;
  const list = useWarehouses({ page: 0, size: PAGE_SIZE.masterData }, { enabled: canRead });
  return { canRead, permissionsPending, list, warehouses: list.data?.items };
}

/** Prefix trong URL → kho (so khớp không phân biệt hoa thường, BE lưu chữ hoa). */
export const samePrefix = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

/** Kho của trang đang mở (theo prefix trên URL). */
export function useWarehouseByPrefix(prefix: string) {
  const workspace = useWorkspaceWarehouses();
  const warehouse = workspace.warehouses?.find((w) => samePrefix(w.prefix, prefix));
  return { ...workspace, warehouse };
}

/** Đoạn prefix trong đường dẫn tab (`/admin/warehouse-map/{prefix}/…`), hoặc `null` ở bước chọn kho. */
export function prefixFromPath(pathname: string, root: string): string | null {
  if (!pathname.startsWith(`${root}/`)) return null;
  const segment = pathname.slice(root.length + 1).split("/")[0];
  return segment ? decodeURIComponent(segment) : null;
}

/**
 * Đổi kho trên breadcrumb (spec §5.7): đổi prefix, giữ trang dài nhất trong `pages` khớp với phần còn lại; trang chi tiết
 * (id phía sau) → về trang list của màn đó ở kho mới, vì bản ghi không có ở kho khác. Bỏ query.
 */
export function switchWarehouseHref(
  pathname: string,
  to: string,
  pages: readonly { path: string }[],
): string {
  const root = ADMIN_ROUTES.warehouseMap.root;
  const rest = pathname.startsWith(`${root}/`)
    ? pathname
        .slice(root.length + 1)
        .split("/")
        .slice(1)
    : [];
  const path = rest.join("/");
  const page = [...pages]
    .filter((p) => p.path !== "" && (path === p.path || path.startsWith(`${p.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return ADMIN_ROUTES.warehouseMap.page(to, page?.path);
}
