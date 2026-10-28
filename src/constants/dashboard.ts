import { INVENTORY_API } from "./inventory";
import { INVENTORY_PERMISSIONS } from "./permissions";

import type { OrderStatus } from "./statuses";

// Wire contract: backend develop — mọi widget tổng quan đọc API thật có sẵn; không có API thì không
// hiện ở chế độ nối BE (xem `MockDashboardPanels`).
export const DASHBOARD_API = {
  orders: "/orders",
  purchaseOrders: "/purchase-orders",
  receipts: "/goods-receipts",
  transfers: "/inventory/transfer-orders",
  pickTasks: "/fulfillment/tasks",
  alerts: INVENTORY_API.alerts,
  alertSummary: "/inventory/alerts/summary",
} as const;

export const DASHBOARD_QUERY_KEYS = {
  count: "dashboard-count",
  alertSummary: "dashboard-alert-summary",
  alerts: "dashboard-alerts",
} as const;

// Đếm bằng `totalElements` của một trang cỡ 1 (BE `Pages`: size tối thiểu 1).
export const DASHBOARD_LIMITS = {
  countPageSize: 1,
  alertRows: 8,
} as const;

// Trạng thái BE (giá trị enum) mỗi chỉ số đếm — không dùng nhãn Title Case của FE.
// OrderStatus.java: đơn đã đặt và chưa giao cho kho thực hiện, cộng đơn đang tạm giữ (ON_HOLD) —
// đơn giữ cũng cần người xử lý (quyết định 20/10).
export const DASHBOARD_ORDER_PENDING_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "ON_HOLD",
] as const;
// Cùng danh sách trên dưới dạng giá trị `?status=` của màn đơn hàng (nhãn FE, `ORDER_STATUSES`), để
// tile mở đúng tập đơn nó đếm. Giữ cùng thứ tự với DASHBOARD_ORDER_PENDING_STATUSES (có test đối chiếu).
export const DASHBOARD_ORDER_PENDING_FILTER = [
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "On Hold",
] as const satisfies readonly OrderStatus[];
// PurchaseOrder: chờ duyệt (docs 02).
export const DASHBOARD_PO_PENDING_STATUSES = ["PENDING_APPROVAL"] as const;
// GoodsReceiptStatus.java / docs 03 §5.1: còn đang xử lý (chưa CLOSED / CANCELLED).
export const DASHBOARD_RECEIPT_PROCESSING_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "IN_QC",
  "IN_PUTAWAY",
] as const;
// TransferStatus.java: hàng đã rời kho nguồn, kho đích chưa nhận đủ.
export const DASHBOARD_TRANSFER_IN_TRANSIT_STATUSES = ["IN_TRANSIT", "PARTIALLY_RECEIVED"] as const;
// PickStatus.java: task lấy hàng chưa xong. BE lọc `status` một giá trị mỗi lần → đếm từng trạng thái rồi cộng.
export const DASHBOARD_PICK_OPEN_STATUSES = ["PENDING", "PICKING"] as const;
// StockAlert.Status: cần người xử lý (chưa ACKNOWLEDGED / RESOLVED).
export const DASHBOARD_ALERT_OPEN_STATUS = "OPEN";

export const DASHBOARD_ALERT_KIND_LABELS: Record<string, string> = {
  REORDER: "Đến điểm đặt hàng",
  SAFETY: "Dưới tồn an toàn",
  EXPIRING: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
};

export const DASHBOARD_ALERT_PERMISSION = INVENTORY_PERMISSIONS.alertRead;

export const DASHBOARD_LABELS = {
  title: "Tổng quan",
  subtitle: "Theo dõi vận hành kho, đơn hàng và tồn kho.",
  ordersPending: "Đơn chờ xử lý",
  poPending: "PO chờ duyệt",
  receiptsProcessing: "Phiếu nhận đang xử lý",
  picksOpen: "Task lấy hàng đang mở",
  // Ngắn để vừa một dòng trong ô dải số liệu ở laptop (~150px)
  transfersInTransit: "Chuyển kho trên đường",
  alertsOpen: "Cảnh báo tồn kho",
  loading: "…",
  unavailable: "—",
  unavailableHint: "Không tải được",
  retry: "Thử lại",
  permissionsError: "Không tải được quyền truy cập nên chưa hiện được số liệu.",
  alertsTitle: "Cảnh báo tồn kho",
  alertsEmptyTitle: "Không có cảnh báo cần xử lý",
  alertsEmptyDescription: "Tồn kho đang trong ngưỡng cấu hình.",
  alertsLoadError: "Không tải được cảnh báo tồn kho.",
  alertKind: "Loại",
  alertSku: "SKU",
  alertWarehouse: "Kho",
  alertAllWarehouses: "Toàn hệ thống",
  alertObserved: "Hiện có",
  alertThreshold: "Ngưỡng",
  alertLot: "Lô",
  alertExpiry: "Hạn dùng",
  alertOpenedAt: "Phát sinh",
  alertsMore: "Chỉ hiện các cảnh báo mới nhất.",
} as const;
