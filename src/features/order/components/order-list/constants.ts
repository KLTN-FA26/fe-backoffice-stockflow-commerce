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
  "customer",
  "recipient",
  "placedAt",
  "paymentTerm",
  "paymentStatus",
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

/** BE OrderRepositoryAdapter: search "contains" trên mã đơn, tên/SĐT liên hệ, tên/SĐT người nhận. */
export const SEARCH_SCOPE_LABEL = "Mã đơn, người liên hệ / người nhận, SĐT";

/** Nhãn bộ lọc riêng — dùng ở hàng bộ lọc và thanh Cấu hình. */
export const FILTER_LABELS = {
  customer: "Mã khách hàng",
  placedAt: "Ngày đặt",
  from: "Từ ngày",
  to: "Đến ngày",
  paymentTerm: "Phương thức thanh toán",
  allTerms: "Tất cả phương thức",
  invalidRange: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu — chưa áp dụng lọc ngày.",
  // CONTRACT PENDING (B0): BE GET /orders chưa có `paymentTerm` — luôn nói rõ khi đang lọc
  termPending:
    "Lọc theo phương thức thanh toán đang chờ máy chủ hỗ trợ chính thức — nếu máy chủ chưa hỗ trợ, danh sách có thể chưa được lọc.",
  termIgnored:
    "Máy chủ chưa hỗ trợ lọc theo phương thức thanh toán — danh sách dưới đây CHƯA được lọc theo tiêu chí này.",
} as const;

/** Tiêu đề cột — dùng chung cho bảng, popover ẩn/hiện cột và thanh Cấu hình. */
export const COLUMN_LABELS: Record<string, string> = {
  orderNumber: "Mã đơn",
  customer: "Khách hàng",
  recipient: "Người nhận",
  paymentTerm: "Phương thức TT",
  paymentStatus: "Thanh toán",
  placedAt: "Ngày đặt",
  totalAmount: "Tổng tiền",
  status: "Trạng thái",
  actions: "Thao tác",
};

/**
 * Đúng 12 trạng thái BE FE hỗ trợ (ORDER_STATUSES) — gồm On Hold, In Production. KHÔNG có
 * `UNKNOWN`: đó là trạng thái chỉ để đọc, không phải giá trị lọc gửi BE.
 */
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
