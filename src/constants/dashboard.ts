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
// GoodsReceiptStatus.java / docs 03 §5: còn đang xử lý (chưa CLOSED / CANCELLED). BE đã bỏ IN_QC (2b) — gửi mã
// đó thì BE trả 400 khi bind enum.
export const DASHBOARD_RECEIPT_PROCESSING_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
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

/**
 * Bảng điều khiển theo vai trò (L-12): ô "việc của bạn" của Sale và Kế toán, đọc API danh sách sẵn có. Mỗi ô gate theo
 * quyền của chính endpoint (+ quyền xác định vai trò nếu cần) — không bịa số khi thiếu API.
 */
export const ROLE_DASHBOARD_API = {
  designQuoteRequests: "/design-quote-requests",
  projectQuoteRequests: "/design-project-quote-requests",
  quotes: "/quotes",
  installments: "/installments",
} as const;

export const ROLE_DASHBOARD_LIMITS = {
  /** "Sắp hết hạn" = hiệu lực còn ≤ chừng này ngày (L-12). */
  expiringWithinDays: 3,
  /** Số báo giá SENT đọc (sắp theo hạn hiệu lực tăng dần) để đếm cái sắp hết hạn — đủ cho mọi trang đầu thực tế. */
  expiringScanSize: 100,
} as const;

export const ROLE_DASHBOARD_LABELS = {
  title: "Việc của bạn",
  newQuoteRequests: "Yêu cầu báo giá mới",
  expiringQuotes: "Báo giá sắp hết hạn (≤ 3 ngày)",
  expiringQuotesTruncated: "Chỉ đếm trong 100 báo giá đã gửi có hạn gần nhất",
  unreadChats: "Tin chat chưa đọc",
  installmentsOwing: "Đợt đến hạn chưa thu",
  installmentsOverdue: "Đợt quá hạn",
} as const;
