"use client";

/**
 * Tab "Kho & bản đồ": trang làm việc theo một kho nằm dưới prefix kho trên URL
 * (`/admin/warehouse-map/{prefix}`) — prefix duy nhất toàn hệ thống và không đổi (BR-10 / BR-13) nên
 * link luôn đúng. BE chỉ đọc kho theo id → đổi prefix ra kho qua danh mục kho (đã cache cho bước chọn).
 * Kho dùng gần nhất nhớ trên máy này để tô sẵn ở bước chọn kho. KHÔNG gắn `X-Warehouse-Id` cho cả app.
 */

import { PAGE_SIZE, WAREHOUSE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useWarehouses } from "./queries";

/** Danh mục kho cho ô đổi kho / tên kho trên breadcrumb — cần `warehouse-warehouses:READ` (BE re-check). */
export function useWorkspaceWarehouses() {
  const canRead = useCan(WAREHOUSE_PERMISSIONS.read);
  const list = useWarehouses({ page: 0, size: PAGE_SIZE.masterData }, { enabled: canRead });
  return { canRead, list, warehouses: list.data?.items };
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
