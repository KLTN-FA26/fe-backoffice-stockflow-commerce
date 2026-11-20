/**
 * Thiết kế của khách (module 12) ở back-office — mã BE và nhãn tiếng Việt dùng chung giữa các feature (duyệt thiết kế,
 * vòng duyệt, yêu cầu báo giá, chat) mà không import chéo. Nguồn: BE origin/develop 5fe7b9a16 — `DesignStatus`,
 * `DesignDecisionType`, `api/DesignArtifactRole`, `service/DesignPreflight.java:126-162`, `QuoteRequestStatus`.
 */

/** BE `DesignStatus`. */
export const DESIGN_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "ARCHIVED"] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

/** Cùng giá trị với `features/chat/selectors.ts` (chat sẽ chuyển sang dùng bản này). */
export const DESIGN_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Bị trả lại / nháp",
  PENDING_REVIEW: "Chờ duyệt thiết kế",
  APPROVED: "Đã duyệt",
  ARCHIVED: "Đã lưu trữ",
};

/** Khoá `lib/status-map` để `StatusDot` tô đúng tone cho trạng thái thiết kế. */
export const DESIGN_STATUS_TONE_KEY: Readonly<Record<DesignStatus, string>> = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  ARCHIVED: "CLOSED",
};

/**
 * BE `DesignDecisionType`. Lịch sử cũ có thể mang mã khác (vd `SENT_TO_CUSTOMER`) → schema để chuỗi, màn hình tra bảng
 * này và hiện nguyên mã khi không có nhãn.
 */
export const DESIGN_DECISION_LABELS: Readonly<Record<string, string>> = {
  CREATED: "Tạo thiết kế",
  DERIVED_FROM_SNAPSHOT: "Tạo từ bản đã duyệt",
  PREFLIGHT_FAILED: "Kiểm tra file không đạt",
  SUBMITTED_FOR_REVIEW: "Gửi duyệt",
  RETURNED: "Trả lại",
  APPROVED: "Duyệt",
  ARCHIVED: "Lưu trữ",
  QUOTE_REQUESTED: "Yêu cầu báo giá",
  ADDED_TO_PROJECT: "Thêm vào dự án",
  REMOVED_FROM_PROJECT: "Bỏ khỏi dự án",
};

/** BE `DesignArtifactRole`. Khách gửi ba loại đầu; phiếu sản xuất do hệ thống sinh khi duyệt. */
export const DESIGN_ARTIFACT_ROLES = [
  "CUSTOMER_PREVIEW",
  "PRINT_READY",
  "TECHNICAL_SPEC",
  "PRODUCTION_INSTRUCTION",
] as const;
export type DesignArtifactRole = (typeof DESIGN_ARTIFACT_ROLES)[number];

/** Bộ file khách gửi duyệt, theo thứ tự hiển thị. */
export const DESIGN_SUBMISSION_ROLES = [
  "CUSTOMER_PREVIEW",
  "PRINT_READY",
  "TECHNICAL_SPEC",
] as const satisfies readonly DesignArtifactRole[];

export const DESIGN_ARTIFACT_ROLE_LABELS: Readonly<Record<string, string>> = {
  CUSTOMER_PREVIEW: "Ảnh xem trước",
  PRINT_READY: "File in (PDF)",
  TECHNICAL_SPEC: "Mô tả thiết kế (PDF)",
  PRODUCTION_INSTRUCTION: "Phiếu sản xuất",
};

/** Mã lỗi preflight của BE (`DesignPreflight.java:126-162`). */
export const PREFLIGHT_CODE_LABELS: Readonly<Record<string, string>> = {
  FONT_NOT_EMBEDDED: "Font chưa nhúng",
  LOW_RESOLUTION: "Ảnh dưới độ phân giải tối thiểu",
  RGB_COLOUR: "Ảnh RGB sẽ đổi sang CMYK",
  NO_BLEED: "Trang không có tràn lề",
  PDF_UNREADABLE: "Không mở được file",
  IMAGE_UNREADABLE: "Không mở được file",
  RASTER_ARTWORK: "Ảnh bitmap",
};

/** BE `QuoteRequestStatus`. */
export const DESIGN_QUOTE_REQUEST_STATUS_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
};

/** Chữ trên màn duyệt thiết kế. */
export const DESIGN_REVIEW_LABELS = {
  queueTitle: "Duyệt thiết kế",
  tabSingle: "Thiết kế đơn lẻ",
  tabProject: "Theo dự án",
  queueEmptyTitle: "Không có thiết kế nào chờ duyệt",
  queueEmptyDescription: "Thiết kế khách gửi duyệt sẽ hiện ở đây, chờ lâu nhất trước.",
  notFoundTitle: "Thiết kế không còn chờ duyệt",
  notFoundDescription: "Thiết kế đã được duyệt, trả lại hoặc khách đã xoá.",
  backToQueue: "Về hàng đợi",
  backToRound: "Về vòng duyệt",
  colorDisclaimer: "Màu in thật có thể khác màn hình.",
  approve: "Duyệt",
  return: "Trả lại",
  approveTitle: "Duyệt thiết kế?",
  approveDescription: "Duyệt sẽ đóng dấu file in, sinh SKU riêng cho khách và khoá thiết kế.",
  approveNotesLabel: "Ghi chú (tuỳ chọn)",
  returnTitle: "Trả lại thiết kế cho khách",
  returnDescription: "Khách sẽ thấy lý do này và gửi lại bộ file sau khi sửa.",
  returnReasonLabel: "Lý do trả lại (khách sẽ thấy)",
  deciding: "Đang duyệt — có thể mất tới một phút",
  approved: "Đã duyệt — đã sinh SKU riêng",
  returned: "Đã trả lại thiết kế cho khách",
  slowOutcome: "Đang xử lý lâu — đã tải lại danh sách",
  staleReload: "Đã tải lại thiết kế — xem lại bộ file rồi quyết định lại.",
  inProject: "Thuộc một dự án — duyệt trong vòng duyệt",
  preflightBlocked: "File in có lỗi chặn — nên trả lại",
} as const;

/** Chữ trên màn vòng duyệt dự án (BO-4). */
export const DESIGN_ROUND_LABELS = {
  listTitle: "Vòng duyệt dự án",
  detailTitle: "Vòng duyệt",
  emptyTitle: "Không có vòng duyệt nào đang chờ",
  emptyDescription: "Dự án khách gửi duyệt cả bộ thiết kế sẽ hiện ở đây, chờ lâu nhất trước.",
  notFoundTitle: "Không tìm thấy vòng duyệt",
  notFoundDescription: "Vòng duyệt không tồn tại hoặc đường dẫn không hợp lệ.",
  statusOpen: "Đang chờ",
  statusClosed: "Đã đóng",
  outcomeApproved: "Đã duyệt",
  outcomeReturned: "Đã trả lại",
  outcomeWaiting: "Đang chờ",
  outcomeGone: "Không còn dữ liệu",
  reviewAndDecide: "Xem & quyết định",
  approveAll: "Duyệt tất cả",
  confirmTitle: "Duyệt tất cả thiết kế còn chờ?",
  running: "Đang duyệt {n} thiết kế… có thể mất vài phút, đừng đóng trang.",
  resultTitle: "Kết quả duyệt tất cả",
  resultApproved: "Đã duyệt",
  resultNotApproved: "Không duyệt được",
  resultSkipped: "Bỏ qua — không còn chờ",
  slowOutcome: "Đang xử lý lâu — đã tải lại vòng duyệt, xem kết quả trên từng thiết kế.",
  approvedSome: "Đã duyệt {n} thiết kế",
} as const;

/** Số ký tự tối đa của lý do trả lại / ghi chú duyệt (BE `DesignReviewService.REASON_MAX`). */
export const DESIGN_REASON_MAX = 2000;

/** Cấu hình danh sách lưu theo trình duyệt (số dòng / trang) — tách khỏi `STORAGE_KEYS` chung. */
export const DESIGN_REVIEW_STORAGE_KEYS = {
  queueConfig: "stockflow:admin:designs:review-queue:config",
  roundsConfig: "stockflow:admin:design-review-rounds:config",
} as const;
