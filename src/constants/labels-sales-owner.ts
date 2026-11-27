/**
 * Nhãn tiếng Việt của Sale phụ trách khách (kế hoạch sales-owner §3, §10; hợp đồng API "FE screens"). Một chỗ cho mọi
 * màn: thẻ trên trang khách, cột danh sách khách, Phân công khách, Lịch người thay, Khách tiềm năng, Yêu cầu đổi Sale.
 */

import type {
  LeadStatus,
  OwnerChangeRequestStatus,
  SalesOwnerChangeReason,
  SalesOwnerState,
} from "./sales-owner";

export const SALES_OWNER_STATE_LABELS: Record<SalesOwnerState, string> = {
  ASSIGNED: "Đã có người phụ trách",
  NEEDS_ASSIGNMENT: "Cần giao người phụ trách",
  UNASSIGNED: "Chưa có người phụ trách",
};

export const SALES_OWNER_CHANGE_REASON_LABELS: Record<SalesOwnerChangeReason, string> = {
  CREATED_BY_SALES: "Sale tạo hồ sơ",
  LEAD_CONVERTED: "Từ khách tiềm năng",
  CLAIMED_FROM_QUEUE: "Nhận từ hàng chờ chat",
  STAFF_LEFT: "Sale nghỉ việc",
  WORKLOAD: "Chia lại tải",
  CUSTOMER_REQUEST: "Khách yêu cầu",
  REGION: "Đổi khu vực",
  TEMPORARY_LEAVE: "Tạm thời — chờ Sale quay lại",
  RETURN_FROM_LEAVE: "Trả lại sau khi nghỉ",
  BACKFILL: "Điền từ dữ liệu cũ",
  OTHER: "Khác",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Mới",
  ASSIGNED: "Đã giao",
  CONTACTED: "Đã liên hệ",
  CONVERTED: "Đã thành khách",
  DISQUALIFIED: "Đã loại",
};

export const OWNER_CHANGE_REQUEST_STATUS_LABELS: Record<OwnerChangeRequestStatus, string> = {
  PENDING: "Chờ quyết định",
  APPROVED: "Đã đồng ý",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Khách đã rút",
};

/** Lý do khách nêu (§10.5); mã lạ hiện nguyên văn. */
export const OWNER_CHANGE_REQUEST_REASON_LABELS: Readonly<Record<string, string>> = {
  SLOW_RESPONSE: "Phản hồi chậm",
  NOT_SATISFIED: "Không hài lòng cách tư vấn",
  PREFER_KNOWN_CONTACT: "Muốn làm việc với người quen",
  OTHER: "Khác",
};

/** Sản phẩm quan tâm của form mở tài khoản (§10.7); mã lạ hiện nguyên văn. */
export const LEAD_INTEREST_LABELS: Readonly<Record<string, string>> = {
  CUP: "Ly",
  BOX: "Hộp",
  BAG: "Túi",
  BOWL: "Tô",
};

export const SALES_OWNER_LABELS = {
  nav: {
    assignment: "Phân công khách",
    covers: "Lịch người thay",
    leads: "Khách tiềm năng",
    requests: "Yêu cầu đổi Sale",
  },
  card: {
    title: "Sale phụ trách",
    since: "Từ ngày",
    change: "Đổi người phụ trách",
    assign: "Giao người phụ trách",
    formerOwner: "Người cũ",
    left: "(đã nghỉ)",
    none: "Chưa có",
    coverLine: (name: string, until: string) => `Đang có ${name} lo thay tới ${until}.`,
    loadError: "Không tải được người phụ trách.",
  },
  history: {
    tab: "Lịch sử phụ trách",
    empty: "Chưa có lần giao / đổi người phụ trách nào.",
    loadError: "Không tải được lịch sử phụ trách.",
    nobody: "Chưa có ai",
  },
  list: {
    column: "Sale phụ trách",
    mine: "Khách của tôi",
    needsAssignment: "Cần giao người phụ trách",
    bySales: "Sale phụ trách",
  },
  picker: {
    paused: "tạm dừng nhận khách",
    onLeave: "đang nghỉ",
    coverBy: (name: string) => `${name} lo thay`,
    empty: "Không có Sale đang làm.",
    suggested: "gợi ý",
  },
  dialog: {
    title: "Đổi người phụ trách",
    assignTitle: "Giao người phụ trách",
    description: (customer: string) =>
      `Chọn Sale phụ trách ${customer}. Hội thoại đang mở và thông báo về sau đi theo người mới; doanh số đã chốt vẫn thuộc người cũ.`,
    sales: "Sale phụ trách mới",
    salesPlaceholder: "Chọn Sale",
    reason: "Lý do",
    reasonPlaceholder: "Chọn một lý do",
    note: "Ghi chú",
    notify: "Báo cho khách trong chat",
    notifyHint: "Khách nhận tin “Từ nay anh/chị được … hỗ trợ”. Bỏ chọn khi đổi nội bộ.",
    submit: "Lưu",
    sameOwner: "Khách đang do Sale này phụ trách.",
  },
} as const;
