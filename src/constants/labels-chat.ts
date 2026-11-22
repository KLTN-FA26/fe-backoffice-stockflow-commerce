/**
 * Chat Sale ↔ khách (docs 16, BE `chat` module origin/develop 438fe6fb) — trạng thái hội thoại, loại thẻ,
 * nhãn tiếng Việt. File riêng, import qua `@/constants`.
 */

/** BE `ConversationStatus`. Kết thúc = RESOLVED / AUTO_CLOSED / CLOSED. */
export const CHAT_CONVERSATION_STATUSES = [
  "NEW",
  "QUEUED",
  "ASSIGNED",
  "ACTIVE",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_INTERNAL",
  "ESCALATED",
  "RESOLVED",
  "REOPENED",
  "AUTO_CLOSED",
  "CLOSED",
] as const;
export type ChatConversationStatus = (typeof CHAT_CONVERSATION_STATUSES)[number];

export const CHAT_STATUS_LABELS = {
  NEW: "Mới",
  QUEUED: "Chờ nhận",
  ASSIGNED: "Đã giao",
  ACTIVE: "Đang trao đổi",
  WAITING_ON_CUSTOMER: "Chờ khách",
  WAITING_ON_INTERNAL: "Chờ nội bộ",
  ESCALATED: "Đã chuyển cấp",
  RESOLVED: "Đã giải quyết",
  REOPENED: "Mở lại",
  AUTO_CLOSED: "Tự đóng",
  CLOSED: "Đã đóng",
} as const satisfies Record<ChatConversationStatus, string>;

/** Khoá status-map để lấy tone cho chấm trạng thái (không tự tô màu). */
export const CHAT_STATUS_TONE_KEY = {
  NEW: "Draft",
  QUEUED: "On Hold",
  ASSIGNED: "Sent",
  ACTIVE: "Sent",
  WAITING_ON_CUSTOMER: "Pending Payment",
  WAITING_ON_INTERNAL: "On Hold",
  ESCALATED: "Exception",
  RESOLVED: "Completed",
  REOPENED: "Sent",
  AUTO_CLOSED: "Closed",
  CLOSED: "Closed",
} as const satisfies Record<ChatConversationStatus, string>;

export const CHAT_ENDED_STATUSES = [
  "RESOLVED",
  "AUTO_CLOSED",
  "CLOSED",
] as const satisfies readonly ChatConversationStatus[];

/** BE `CardKind` + nhãn thẻ. */
export const CHAT_CARD_LABELS: Readonly<Record<string, string>> = {
  QUOTE_REQUEST: "Yêu cầu báo giá",
  QUOTE: "Báo giá",
  CONTRACT: "Hợp đồng",
  PAYMENT_INFO: "Thông tin chuyển khoản",
  PAYMENT_REMINDER: "Nhắc thanh toán",
  SAMPLE_APPROVAL: "Duyệt mẫu",
  INVOICE: "Hoá đơn",
  ORDER_STATUS: "Trạng thái đơn",
  PRODUCTION_PROGRESS: "Tiến độ sản xuất",
  CSAT_SURVEY: "Đánh giá hỗ trợ",
};

/** BE `CardState`. */
export const CHAT_CARD_STATE_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Đang mở",
  ACTED: "Đã xử lý",
  SUPERSEDED: "Đã thay bằng bản mới",
  EXPIRED: "Hết hiệu lực",
  CANCELLED: "Đã huỷ",
  CLOSED: "Đã đóng",
};

/** BE `ContextKind` → nhãn chứng từ. */
export const CHAT_CONTEXT_LABELS: Readonly<Record<string, string>> = {
  PRODUCT: "Sản phẩm",
  CUSTOMER_SKU: "SKU riêng",
  DESIGN: "Thiết kế",
  DESIGN_PROJECT: "Dự án thiết kế",
  QUOTE: "Báo giá",
  ORDER: "Đơn hàng",
  CONTRACT: "Hợp đồng",
  PRODUCTION_ORDER: "Lệnh sản xuất",
  EINVOICE: "Hoá đơn điện tử",
};

/** Bộ lọc hộp thư (S1): của tôi / chưa phân công / quá hạn. */
export const CHAT_INBOX_SCOPES = ["all", "mine", "unassigned", "overdue"] as const;
export type ChatInboxScope = (typeof CHAT_INBOX_SCOPES)[number];
export const CHAT_INBOX_SCOPE_LABELS = {
  all: "Tất cả",
  mine: "Của tôi",
  unassigned: "Chưa phân công",
  overdue: "Quá hạn",
} as const satisfies Record<ChatInboxScope, string>;

/** Socket chat chưa nối (hoặc không có `NEXT_PUBLIC_WS_URL`): hội thoại cập nhật bằng polling 5 giây. */
export const CHAT_POLL_MS = 5_000;
/** Số chưa đọc trên menu (S22) đọc thưa hơn: chỉ là huy hiệu. */
export const CHAT_BADGE_POLL_MS = 30_000;
/**
 * Socket chat đang nối (FE fix list A.3): sự kiện STOMP cập nhật màn hình, polling chỉ còn là lưới an toàn (BE đẩy
 * "best effort" — `ChatBroadcaster`), 30–60 giây và dừng khi tab ẩn.
 */
export const CHAT_LIVE_POLL_MS = 45_000;
/** Gộp các lần tải lại do một loạt sự kiện socket gần nhau thành một. */
export const CHAT_REALTIME_COALESCE_MS = 250;

/** Tìm trong tin nhắn (S21): 2–200 ký tự sau khi bỏ khoảng trắng hai đầu, BE trả 400 nếu sai. */
export const CHAT_SEARCH_MIN = 2;
export const CHAT_SEARCH_MAX = 200;

/**
 * Chứng từ Sale gắn được vào hội thoại (S13, 16 BR-02) — chọn trong hồ sơ khách (S16), không gõ mã tay.
 * Thứ tự = thứ tự trong ô chọn.
 */
export const CHAT_ATTACHABLE_CONTEXTS = [
  "QUOTE",
  "ORDER",
  "CONTRACT",
  "PRODUCTION_ORDER",
  "DESIGN",
] as const;
export type ChatAttachableContext = (typeof CHAT_ATTACHABLE_CONTEXTS)[number];

/** @nhắc đồng nghiệp trong ghi chú nội bộ (BE-11 `GET /chat/staff`). */
export const CHAT_MENTION_LABELS = {
  pickerLabel: "Chọn người được nhắc",
  searching: "Đang tìm…",
  loadError: "Không tải được danh sách nhân viên.",
  noMatch: "Không có nhân viên khớp.",
  /** BE chỉ trả id người được nhắc, không trả tên. */
  mentionedCount: (count: number) => `Nhắc ${count} người`,
} as const;
/** Chờ người gõ dừng trước khi tìm người để @nhắc (api-conventions §9.6). */
export const CHAT_MENTION_DEBOUNCE_MS = 300;

/** Thông báo từ socket chat (A.3). */
export const CHAT_REALTIME_LABELS = {
  mentioned: (sender: string | null | undefined) =>
    sender ? `${sender} nhắc bạn trong ghi chú nội bộ` : "Bạn được nhắc trong một ghi chú nội bộ",
} as const;

/**
 * BO-UX-44: đổi trạng thái bằng ĐỘNG TỪ (khác nhãn trạng thái ở chấm màu). Chỉ các đích Sale đổi tay (BE
 * `Conversation.askedForByHand`); RESOLVED kết thúc hội thoại nên phải xác nhận.
 */
export const CHAT_STATUS_MOVE_LABELS = {
  ACTIVE: "Tiếp tục trao đổi",
  WAITING_ON_CUSTOMER: "Chuyển sang chờ khách",
  WAITING_ON_INTERNAL: "Chuyển sang chờ nội bộ",
  ESCALATED: "Chuyển cấp cho quản lý…",
  RESOLVED: "Đánh dấu đã giải quyết…",
} as const satisfies Partial<Record<ChatConversationStatus, string>>;
export const CHAT_STATUS_MENU_LABELS = {
  trigger: "Đổi trạng thái",
  resolveTitle: "Đánh dấu hội thoại đã giải quyết?",
  resolveDescription:
    "Hội thoại sẽ kết thúc và khách được mời đánh giá. Khách vẫn mở lại được trong thời gian ngắn sau đó.",
  resolveConfirm: "Đánh dấu đã giải quyết",
} as const;

/** BO-UX-43: ô soạn nói rõ tin đi đâu — bằng chữ và biểu tượng, không chỉ bằng màu. */
export const CHAT_COMPOSER_LABELS = {
  modeGroup: "Loại tin",
  replyMode: "Trả lời khách",
  noteMode: "Ghi chú nội bộ",
  replyBanner: "Đang trả lời khách — khách sẽ đọc được tin này.",
  noteBanner: "Ghi chú nội bộ — chỉ nhân viên thấy, khách không thấy.",
  replyField: "Tin nhắn cho khách",
  noteField: "Ghi chú nội bộ",
  replyPlaceholder: "Nhập tin nhắn cho khách…",
  notePlaceholder: "Ghi chú cho đồng nghiệp — gõ @ để nhắc tên",
  sendReply: "Gửi cho khách",
  sendNote: "Lưu ghi chú nội bộ",
  mentionInReply:
    "Tin này sẽ gửi cho khách nhưng có @nhắc đồng nghiệp. Bạn định viết ghi chú nội bộ?",
  switchToNote: "Chuyển sang ghi chú nội bộ",
} as const;

/** BO-UX-6: không bao giờ hiện mã BE thô khi thiếu nhãn. */
export const CHAT_UNKNOWN_LABELS = {
  card: "Thẻ",
  state: "Không rõ trạng thái",
  designStatus: "Chưa rõ trạng thái thiết kế",
} as const;

/** BO-UX-48: khoá status-map cho chấm trạng thái của thẻ (BE `CardState`), lấy tone chứ không tự tô màu. */
export const CHAT_CARD_STATE_TONE_KEY: Readonly<Record<string, string>> = {
  OPEN: "Sent",
  ACTED: "Completed",
  SUPERSEDED: "Superseded",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

/** "Đã xử lý" theo nghĩa của từng loại thẻ (BE `CardActions`): khách chấp nhận báo giá, ký hợp đồng, trả đợt… */
export const CHAT_CARD_ACTED_LABELS: Readonly<Record<string, string>> = {
  QUOTE_REQUEST: "Đã lập báo giá",
  QUOTE: "Khách đã chấp nhận",
  CONTRACT: "Đã ký",
  PAYMENT_INFO: "Đã thanh toán",
  PAYMENT_REMINDER: "Đã thanh toán",
  SAMPLE_APPROVAL: "Khách đã trả lời",
  CSAT_SURVEY: "Khách đã đánh giá",
};

/** BO-UX-45: thẻ chuyển khoản — cùng các trường ở hộp xem trước và ở thẻ trong hội thoại. */
export const CHAT_TRANSFER_LABELS = {
  bank: "Ngân hàng",
  account: "Số tài khoản",
  holder: "Chủ tài khoản",
  amount: "Số tiền",
  content: "Nội dung CK",
  dueDate: "Hạn trả",
  noBank: "Chưa cấu hình tài khoản ngân hàng của công ty.",
  qrLabel: "Mã VietQR chuyển khoản",
  qrCaption: "Quét bằng ứng dụng ngân hàng: tài khoản, số tiền và nội dung được điền sẵn.",
  previewTitle: "Khách sẽ nhận thẻ này",
  previewLoading: "Đang tải bản xem trước…",
  previewError:
    "Không tải được bản xem trước. Bạn vẫn gửi được: hệ thống tự điền thẻ từ đợt đã chọn.",
  previewNoQr: "Mã VietQR được tạo khi gửi thẻ.",
  pickFirst: "Chọn đợt để xem trước thẻ.",
} as const;

/** BO-UX-46 / BO-UX-47: trợ năng của khung tin và hộp thư. */
export const CHAT_A11Y_LABELS = {
  messageRegion: "Tin nhắn của hội thoại",
  messageList: "Tin nhắn",
  newMessagesLog: "Tin mới",
  jumpToNew: "Có tin mới",
  jumpToNewAria: "Có tin mới — cuộn xuống tin mới nhất",
  customer: "Khách",
  system: "Hệ thống",
  attachment: "tệp đính kèm",
  newMessage: (sender: string, preview: string) => `Tin mới từ ${sender}: ${preview}`,
  unreadBadge: (count: number) => `${count} tin chưa đọc`,
} as const;
