import { DESIGN_REVIEW_LABELS, DESIGN_ROUND_LABELS } from "@/constants";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

/** BE V20261213000200: `design-designs:APPROVE` chuyển từ Quản lý bán hàng sang Điều phối sản xuất. */
const REVIEWER_ONLY = "Chỉ Điều phối sản xuất được duyệt thiết kế của khách.";

export const REVIEW_QUEUE_COPY: LoadErrorCopy = {
  pageTitle: DESIGN_REVIEW_LABELS.queueTitle,
  notFoundTitle: "Không tải được hàng đợi",
  notFoundDescription: "Hàng đợi duyệt thiết kế không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: REVIEWER_ONLY,
  noReadDescription: "Tài khoản của bạn chưa có quyền duyệt thiết kế.",
};

/** 404 khi mở chi tiết = thiết kế không còn chờ duyệt (BE ẩn thiết kế đã quyết định khỏi người duyệt). */
export const DESIGN_DETAIL_COPY: LoadErrorCopy = {
  pageTitle: "Thiết kế của khách",
  notFoundTitle: DESIGN_REVIEW_LABELS.notFoundTitle,
  notFoundDescription: DESIGN_REVIEW_LABELS.notFoundDescription,
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem thiết kế của khách.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem thiết kế. Liên hệ quản trị để được cấp.",
};

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

/** Ảnh xem trước khách gửi luôn là PNG (storefront `studio/submission-bundle.ts`); `previewUrl` không kèm kiểu file. */
export const PREVIEW_CONTENT_TYPE = "image/png";

export const REVIEW_ROUNDS_COPY: LoadErrorCopy = {
  pageTitle: DESIGN_ROUND_LABELS.listTitle,
  notFoundTitle: DESIGN_ROUND_LABELS.notFoundTitle,
  notFoundDescription: DESIGN_ROUND_LABELS.notFoundDescription,
  forbiddenDescription: REVIEWER_ONLY,
  noReadDescription: "Tài khoản của bạn chưa có quyền duyệt thiết kế.",
};

/** "Mã: 1a2b3c4d…9f0e" — id dài rút gọn, bản đầy đủ đặt ở `title` (backoffice-erp-ui B17). */
export function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/** Chữ bố cục ERP của danh sách (lọc cột trong trang đang xem, thông báo trong thân bảng). */
export const REVIEW_LIST_COPY = {
  actions: "Thao tác",
  noResultsTitle: "Không tìm thấy kết quả",
  noResultsDescription: (noun: string) =>
    `Không có ${noun} nào trên trang đang xem khớp ô tìm hoặc bộ lọc. Lọc chỉ xét trang đang xem.`,
  clearFilters: "Bỏ bộ lọc",
  invalidPageTitle: "Trang không còn dữ liệu",
  invalidPageDescription: "Trang hiện tại vượt quá số trang có dữ liệu.",
  firstPage: "Về trang đầu",
  caption: (shown: number, total: number, noun: string) => `Hiển thị ${shown} / ${total} ${noun}`,
  filteredCaption: (shown: number, onPage: number, total: number, noun: string) =>
    `Lọc trong trang đang xem: ${shown} / ${onPage} ${noun} · tổng ${total}`,
  refetching: (noun: string) => `Đang tải lại danh sách ${noun}`,
  viewDesignAction: "Xem và duyệt",
  viewRoundAction: "Xem vòng duyệt",
  viewDesign: (name: string) => `Xem và duyệt thiết kế ${name}`,
  viewRound: (project: string) => `Xem vòng duyệt dự án ${project}`,
  filterDesign: { label: "thiết kế", placeholder: "Tìm theo tên thiết kế…" },
  filterCustomer: { label: "khách hàng", placeholder: "Tìm theo tên khách hàng…" },
  filterProject: { label: "dự án", placeholder: "Tìm theo tên dự án…" },
} as const;

/** Ô tìm + bảng "Bộ lọc" của hai danh sách duyệt — chỉ xét trang đang xem (BE chỉ nhận page / size). */
export const REVIEW_TOOLBAR_COPY = {
  all: "Tất cả",
  customer: "Khách hàng",
  customerSearch: "Tìm khách hàng…",
  customerEmpty: "Không có khách hàng trên trang này.",
  wait: "Thời gian chờ",
  waitSearch: "Tìm mốc chờ…",
  waitEmpty: "Không có mốc phù hợp.",
  waitLt1d: "Dưới 1 ngày",
  wait1to3d: "1 – 3 ngày",
  waitGt3d: "Trên 3 ngày",
  queueSearch: "Tìm trong trang đang xem: thiết kế, khách, sản phẩm, SKU…",
  roundSearch: "Tìm trong trang đang xem: dự án, khách hàng…",
} as const;

/** Chữ trang chi tiết thiết kế (object page ERP). */
export const DESIGN_DETAIL_LABELS = {
  profile: "Hồ sơ thiết kế",
  lifecycle: "Vòng đời thiết kế",
  steps: { DRAFT: "Khách soạn", PENDING_REVIEW: "Chờ duyệt", APPROVED: "Đã duyệt" },
  archived: "Đã lưu trữ",
  code: "Mã thiết kế",
  customer: "Khách hàng",
  product: "Sản phẩm · biến thể",
  sku: "SKU phôi",
  templateCode: "Mã cấu hình in",
  requestedAt: "Gửi duyệt lúc",
  waiting: "Thời gian chờ",
  scope: "Phạm vi duyệt",
  scopeProject: "Trong vòng duyệt dự án",
  scopeSingle: "Thiết kế đơn lẻ",
  updatedAt: "Cập nhật lúc",
  preview: "Xem trước",
  noPreview: "Chưa có ảnh xem trước.",
  files: "File đã gửi",
  filesDescription: "Bộ file đang chờ duyệt — bản mới nhất của mỗi loại file.",
  noFiles: "Khách chưa gửi file nào.",
  previousFiles: "Các lần gửi trước",
  preflight: "Kiểm tra file in",
  preflightDescription: "Font, độ phân giải, hệ màu và tràn lề của file in. Có thể mất vài giây.",
  preflightRun: "Chạy kiểm tra",
  preflightRetry: "Thử lại",
  preflightIdle: "Chưa chạy kiểm tra — bấm “Chạy kiểm tra” khi cần.",
  quoteRequests: "Yêu cầu báo giá đi kèm",
  quoteRequestsDescription: "Duyệt xong sẽ có báo giá cần lập cho các yêu cầu này.",
  history: "Lịch sử",
} as const;

/** Chữ trang chi tiết vòng duyệt dự án (object page ERP). */
export const ROUND_DETAIL_LABELS = {
  code: "Mã vòng duyệt",
  profile: "Hồ sơ vòng duyệt",
  lifecycle: "Vòng đời vòng duyệt",
  customer: "Khách hàng",
  submittedAt: "Gửi lúc",
  waiting: "Thời gian chờ",
  closedAt: "Đóng lúc",
  designCount: "Số thiết kế",
  approved: "Đã duyệt",
  returned: "Đã trả lại",
  waitingCount: "Còn chờ",
  designs: "Thiết kế trong vòng",
  designsDescription:
    "Mở từng thiết kế để xem bộ file và quyết định, hoặc duyệt tất cả ở đầu trang.",
  colPreview: "Ảnh",
  colDesign: "Thiết kế",
  colProduct: "Sản phẩm · biến thể",
  colSku: "SKU phôi",
  colOutcome: "Kết quả",
  colMessage: "Chi tiết",
  resultDescription: "Kết quả lần “Duyệt tất cả” vừa chạy, theo từng thiết kế.",
  /** `NOT_APPROVED` không kèm câu BE → nhãn chung, không hiện mã lỗi thô (backoffice-erp-ui B17). */
  notApprovedFallback: "BE không duyệt được thiết kế này — mở thiết kế để xem lại.",
  emptyDesigns: "Vòng duyệt chưa có thiết kế.",
} as const;

/** Ô lọc của bảng thiết kế trong vòng duyệt. */
export const ROUND_DESIGN_FILTER_COPY = {
  name: { label: "thiết kế", placeholder: "Tìm theo tên thiết kế…" },
  outcome: { label: "kết quả", search: "Tìm kết quả…", empty: "Không có kết quả" },
  noResults: "Không có thiết kế nào khớp ô lọc ở cột.",
} as const;
