import type { OrderStatus } from "./statuses";

// Wire contract: backend develop — mọi widget tổng quan đọc API thật có sẵn; không có API thì không
// hiện ở chế độ nối BE (xem `MockDashboardPanels`).
export const DASHBOARD_API = {
  orders: "/orders",
  receipts: "/goods-receipts",
  pickTasks: "/fulfillment/tasks",
} as const;

export const DASHBOARD_QUERY_KEYS = {
  count: "dashboard-count",
} as const;

// Đếm bằng `totalElements` của một trang cỡ 1 (BE `Pages`: size tối thiểu 1).
export const DASHBOARD_LIMITS = {
  countPageSize: 1,
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
// GoodsReceiptStatus.java / docs 03 §5.1: còn đang xử lý (chưa CLOSED / CANCELLED).
export const DASHBOARD_RECEIPT_PROCESSING_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "IN_QC",
  "IN_PUTAWAY",
] as const;
// PickStatus.java: task lấy hàng chưa xong. BE lọc `status` một giá trị mỗi lần → đếm từng trạng thái rồi cộng.
export const DASHBOARD_PICK_OPEN_STATUSES = ["PENDING", "PICKING"] as const;

export const DASHBOARD_LABELS = {
  title: "Tổng quan",
  subtitle: "Theo dõi vận hành kho, đơn hàng và tồn kho.",
  ordersPending: "Đơn chờ xử lý",
  receiptsProcessing: "Phiếu nhận đang xử lý",
  picksOpen: "Task lấy hàng đang mở",
  loading: "…",
  unavailable: "—",
  unavailableHint: "Không tải được",
  retry: "Thử lại",
  permissionsError: "Không tải được quyền truy cập nên chưa hiện được số liệu.",
} as const;
