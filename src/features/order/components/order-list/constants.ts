import { ORDER_STATUSES, PAGE_SIZE } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

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
  "totalAmount",
  "payment",
  "status",
  "nextStep",
  "actions",
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: OrderPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/**
 * Cột sort phía server — đúng whitelist của BE `GET /orders` (`OrderServiceImpl.LIST_SORT`, tham số
 * `sort=field,dir`; mặc định `placedAt` giảm dần). Field ngoài danh sách → 400 UNSUPPORTED_PARAMETER.
 */
export const SERVER_SORT_FIELDS = ["orderNumber", "placedAt", "totalAmount", "status"] as const;
export type ServerSortField = (typeof SERVER_SORT_FIELDS)[number];

/** BE OrderRepositoryAdapter: search "contains" trên mã đơn, tên/SĐT liên hệ, tên/SĐT người nhận. */
export const SEARCH_SCOPE_LABEL = "Mã đơn, người liên hệ / người nhận, SĐT";

/** Nhãn bộ lọc riêng — dùng ở hàng bộ lọc và thanh Cấu hình. */
export const FILTER_LABELS = {
  // BE lọc theo UUID khách (`customerId`) — người dùng chọn theo tên / MST, không bao giờ gõ UUID (R3)
  customer: "Khách hàng",
  // Vai trò không có `customer-customers:READ` (BE trả 403 ở GET /customers): không có ô chọn khách, chỉ có nút lọc nhanh ở từng dòng
  customerNoPicker:
    "Bạn không xem được danh bạ khách. Để lọc theo khách, bấm biểu tượng phễu cạnh tên khách ở dòng đơn.",
  placedAt: "Ngày đặt",
  from: "Từ ngày",
  to: "Đến ngày",
  invalidRange: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu — chưa áp dụng lọc ngày.",
} as const;

/** Tiêu đề cột — dùng chung cho bảng, popover ẩn/hiện cột và thanh Cấu hình. */
export const COLUMN_LABELS: Record<string, string> = {
  orderNumber: "Mã đơn",
  customer: "Khách hàng",
  recipient: "Người nhận",
  placedAt: "Ngày đặt",
  totalAmount: "Tổng tiền",
  payment: "Thanh toán",
  status: "Trạng thái",
  nextStep: "Việc tiếp theo",
  actions: "Thao tác",
};

/** "Việc tiếp theo" của một dòng — chỉ suy ra từ field `GET /orders` đã trả (trạng thái, lý do giữ, kho xuất). */
export const NEXT_STEP_LABELS = {
  draft: "Lập hợp đồng",
  pendingContract: "Chờ khách ký hợp đồng",
  pendingPayment: "Chờ khách trả đợt khi ký",
  chooseWarehouse: "Chọn kho xuất",
  creditHold: "Chờ Kế toán duyệt công nợ",
  deliveryFailedHold: "Quyết định hồ sơ giao thất bại",
  otherHold: "Xử lý lý do giữ đơn",
  deliveryFailed: "Xử lý giao thất bại",
} as const;

/** Ô "Thanh toán" (audit bo-17): đã thu / còn phải thu của các đợt, phần quá hạn tô đỏ. */
export const PAYMENT_CELL_LABELS = {
  paid: "Đã thu",
  outstanding: "Còn",
  overdue: "Quá hạn",
  noContract: "Chưa có hợp đồng",
} as const;

/**
 * 19 trạng thái BE (ORDER_STATUSES, PR #133). KHÔNG có `UNKNOWN`: đó là trạng thái chỉ để đọc
 * (`ORDER_READ_STATUSES`), không phải giá trị lọc gửi BE — kiểu `OrderStatus` đã loại nó.
 */
export const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = ORDER_STATUSES.map(
  (value) => ({
    label: statusLabelVi(value, "order") ?? value,
    value,
  }),
);

/** Giá trị trạng thái hợp lệ trên URL (`?status=`) — không gồm "UNKNOWN", mã cũ (Paid / In Fulfilment) bị bỏ. */
export const FILTERABLE_STATUSES: readonly OrderStatus[] = STATUS_OPTIONS.map((o) => o.value);

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
