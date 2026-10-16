import { ORDER_STATUSES, PAGE_SIZE } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/status-map";

import type { OrderStatus } from "../../types";

/** Sở thích hiển thị của page (localStorage qua usePageConfig) — filter/search/sort/page nằm trên URL. */
export interface OrderPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

export const DEFAULT_COLUMNS = [
  "orderNumber",
  "recipient",
  "placedAt",
  "totalAmount",
  "status",
  "actions",
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: OrderPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/**
 * Cột sort phía server. ASSUMPTION (open-question Tú): BE chưa có `GET /orders` cho admin —
 * chọn theo field có trong `OrderResponse`; xác nhận whitelist khi BE bổ sung endpoint.
 */
export const SERVER_SORT_FIELDS = ["orderNumber", "placedAt", "totalAmount", "status"] as const;
export type ServerSortField = (typeof SERVER_SORT_FIELDS)[number];

/** ASSUMPTION: phạm vi search phía server (mock đang quét các field này). */
export const SEARCH_SCOPE_LABEL = "Mã đơn, người nhận, SĐT";

/** Tiêu đề cột — dùng chung cho bảng, popover ẩn/hiện cột và thanh Cấu hình. */
export const COLUMN_LABELS: Record<string, string> = {
  orderNumber: "Mã đơn",
  recipient: "Người nhận",
  placedAt: "Ngày đặt",
  totalAmount: "Tổng tiền",
  status: "Trạng thái",
  actions: "Thao tác",
};

/** Đúng 10 trạng thái BE (ORDER_STATUSES). */
export const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = ORDER_STATUSES.map(
  (value) => ({
    label: STATUS_LABEL_VI[value] ?? value,
    value,
  }),
);

export function mergeStoredConfig(
  stored: Partial<OrderPageConfig>,
  fallback: OrderPageConfig,
): OrderPageConfig {
  // Bỏ key cột cũ (vd `grandTotal`, `recipientName` của bản trước) để không vỡ page
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
