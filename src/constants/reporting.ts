import { REPORTING_PERMISSIONS } from "./permissions";

import type { OrderStatus } from "./statuses";

// Wire contract: BE `ReportController` (be-backoffice PR #170), prefix `/api/v1/reports` (the axios
// base URL already carries `/api/v1`).
export const REPORTING_API = {
  salesDaily: "/reports/sales-daily",
  topProducts: "/reports/top-products",
  orderStatusCounts: "/reports/order-status-counts",
  summary: "/reports/summary",
  rebuild: "/reports/rebuild",
} as const;

export const REPORTING_QUERY_ROOT = "reporting" as const;

export const REPORTING_READ_PERMISSION = REPORTING_PERMISSIONS.read;
export const REPORTING_REBUILD_PERMISSION = REPORTING_PERMISSIONS.export;

export const REPORTING_LIMITS = {
  // BE: a range longer than 366 days is 400 VALIDATION_FAILED.
  maxRangeDays: 366,
  defaultRangeDays: 30,
  rangePresets: [7, 30, 90],
  // DASH-KPI: top 10 SKUs.
  topProductsLimit: 10,
} as const;

// Dashboard URL keys — `from`/`to` are generic enough to collide with list filters elsewhere.
export const REPORTING_URL_KEYS = { from: "salesFrom", to: "salesTo" } as const;

// BE `OrderStatus.java` code -> FE (Title Case) status, which `lib/status-map` resolves to the shared
// Vietnamese label and tone. Mirrors `features/order/status-map.ts` (features may not import each other).
export const REPORT_ORDER_STATUS_TO_FE = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending Payment",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  READY_TO_FULFILL: "Ready to Fulfill",
  PICKING: "Picking",
  PARTIALLY_FULFILLED: "Partially Fulfilled",
  PACKED: "Packed",
  ON_HOLD: "On Hold",
  SHIPPED: "Shipped",
  DELIVERY_FAILED: "Delivery Failed",
  DELIVERED: "Delivered",
  RETURN_REQUESTED: "Return Requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
} as const satisfies Record<string, OrderStatus>;

export const REPORTING_LABELS = {
  title: "Doanh số",
  revenue: "Doanh thu",
  orders: "Số đơn",
  averageOrderValue: "Giá trị đơn trung bình",
  changeVsPrevious: "so với kỳ trước",
  rangeLabel: "Khoảng thời gian",
  presetDays: (days: number) => `${days} ngày`,
  customRange: "Tuỳ chọn",
  from: "Từ ngày",
  to: "Đến ngày",
  apply: "Áp dụng",
  rangeInvalid: "Ngày không hợp lệ.",
  rangeReversed: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
  rangeTooLong: (max: number) => `Khoảng tối đa ${max} ngày.`,
  dailyTitle: "Doanh thu và số đơn theo ngày",
  topTitle: "Top 10 SKU theo doanh thu",
  statusTitle: "Đơn hàng theo trạng thái",
  sku: "SKU",
  productName: "Sản phẩm",
  quantitySold: "Đã bán",
  emptyTitle: "Chưa có đơn trong khoảng này",
  emptyDescription: "Thử chọn khoảng thời gian rộng hơn.",
  loadError: "Không tải được số liệu doanh số.",
  retry: "Thử lại",
  rebuild: "Tính lại số liệu",
  rebuildTitle: "Tính lại số liệu báo cáo?",
  rebuildDescription: (from: string, to: string) =>
    `Hệ thống sẽ tính lại doanh số từ đơn hàng trong khoảng ${from} → ${to}. Thao tác an toàn, có thể chạy lại.`,
  rebuildConfirm: "Tính lại",
  rebuildCancel: "Quay lại",
  rebuildDone: (days: number, counted: number, seen: number) =>
    `Đã tính lại ${days} ngày: ${counted}/${seen} đơn được tính vào doanh thu`,
  rebuildFailed: "Không tính lại được số liệu",
  ordersAxis: "Đơn",
  revenueAxis: "Doanh thu",
} as const;
