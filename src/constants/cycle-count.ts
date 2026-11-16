import { SHARED_QUERY_ROOTS } from "./query-roots";

/**
 * Kiểm kê theo thùng (docs 20 §4.2, §5.2). Hợp đồng chép từ BE develop df34c338
 * `CycleCountController` (`/api/v1/inventory/cycle-counts`). Người đếm chỉ xác nhận từng thùng LPN
 * có mặt / không thấy — không bao giờ nhập số lượng (BR-14).
 */
export const CYCLE_COUNT_API = {
  list: "/inventory/cycle-counts",
  detail: (id: string) => `/inventory/cycle-counts/${encodeURIComponent(id)}`,
  line: (id: string, lineId: string) =>
    `/inventory/cycle-counts/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}/count`,
  addLine: (id: string) => `/inventory/cycle-counts/${encodeURIComponent(id)}/lines`,
  submission: (id: string) => `/inventory/cycle-counts/${encodeURIComponent(id)}/submission`,
  recounts: (id: string) => `/inventory/cycle-counts/${encodeURIComponent(id)}/recounts`,
  cancellation: (id: string) => `/inventory/cycle-counts/${encodeURIComponent(id)}/cancellation`,
} as const;

export const CYCLE_COUNT_QUERY_KEYS = {
  all: "inventory-cycle-counts",
  stock: SHARED_QUERY_ROOTS.inventoryStock,
} as const;

// BE CycleCountStatus; docs 20 §5.2 (Planned, In Progress, Completed, Cancelled).
export const CYCLE_COUNT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const CYCLE_COUNT_STATUS = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, (typeof CYCLE_COUNT_STATUSES)[number]>;

// BE CycleCountTrigger; docs 20 §5.2 "Nguồn phát sinh".
export const CYCLE_COUNT_TRIGGERS = [
  "MANUAL",
  "SHORT_PICK",
  "SCHEDULED",
  "MOVE_DISCREPANCY",
] as const;
export const CYCLE_COUNT_TRIGGER = { SHORT_PICK: "SHORT_PICK" } as const;
export const CYCLE_COUNT_TRIGGER_LABELS = {
  MANUAL: "Quản lý kho lập tay",
  SHORT_PICK: "Báo thiếu khi lấy hàng",
  SCHEDULED: "Theo lịch",
  MOVE_DISCREPANCY: "Lệch khi di chuyển",
} as const satisfies Record<(typeof CYCLE_COUNT_TRIGGERS)[number], string>;

export const CYCLE_COUNT_LIMITS = {
  // Docs 20 BR-12: tối đa 500 dòng đếm (thùng) cho một phiếu.
  maxLines: 500,
  lpnLength: 30,
  locationLength: 64,
  reasonLength: 500,
  noteLength: 500,
} as const;

export const CYCLE_COUNT_ROUTES = {
  list: "/admin/inventory/cycle-counts",
  detail: (id: string) => `/admin/inventory/cycle-counts/${encodeURIComponent(id)}`,
} as const;

export const CYCLE_COUNT_STORAGE_KEYS = {
  list: "stockflow:admin:inventory:cycle-counts:config",
} as const;

export const CYCLE_COUNT_ACTION = {
  SUBMIT: "submit",
  CANCEL: "cancel",
  RECOUNT: "recount",
} as const;

export const CYCLE_COUNT_LINE_STATE = {
  PENDING: "pending",
  PRESENT: "present",
  MISSING: "missing",
} as const;

export const CYCLE_COUNT_LABELS = {
  title: "Kiểm kê",
  number: "Mã phiếu kiểm kê",
  trigger: "Nguồn phiếu",
  status: "Trạng thái",
  plannedDate: "Ngày kiểm",
  progress: "Đã đếm",
  variances: "Chênh lệch",
  blind: "Kiểm mù",
  blindBadge: "Kiểm mù",
  blindHint: "Số sổ sách và ghi chú của phiếu được ẩn với người đếm.",
  counter: "Người đếm",
  assignedToYou: "Giao cho bạn",
  assignedToOther: "Giao cho người khác",
  unassigned: "Chưa giao người đếm",
  note: "Ghi chú",
  startedAt: "Bắt đầu đếm",
  completedAt: "Nộp phiếu",
  noCounts: "Chưa có phiếu kiểm kê",
  noCountsDescription:
    "Phiếu kiểm kê do quản lý kho lập, hoặc hệ thống tự mở khi nhân viên báo thiếu thùng lúc lấy hàng.",
  all: "Tất cả",
  statusFilter: "Trạng thái",
  open: "Mở phiếu",
  fetching: "Đang cập nhật dữ liệu",
  trace: "Mã tra cứu",
  missing: "—",
  // Quét
  scanLocation: "Quét vị trí",
  scanLocationHint: "Quét mã vị trí của kệ đang đếm.",
  scanCarton: "Quét LPN thùng",
  scanCartonHint:
    "Quét từng thùng thấy tại vị trí. Thùng không có trên phiếu sẽ được thêm vào phiếu.",
  currentLocation: "Đang đếm tại",
  changeLocation: "Đổi vị trí",
  scanPresent: (lpn: string) => `Đã ghi nhận thùng ${lpn} có mặt.`,
  scanAdded: (lpn: string) => `Đã thêm thùng ${lpn} ngoài phiếu.`,
  scanLocationSet: (location: string) => `Đang đếm tại ${location}.`,
  scanWrongLocation: (lpn: string, planned: string) =>
    `Thùng ${lpn} thuộc vị trí ${planned} trên phiếu, không phải vị trí đang đếm. Báo quản lý kho xử lý lệch vị trí.`,
  // Dòng đếm
  lines: "Thùng cần đếm",
  location: "Vị trí",
  lpn: "LPN",
  sku: "SKU",
  lot: "Lô",
  counted: "Kết quả đếm",
  booked: "Sổ sách",
  bookedYes: "Có trong sổ",
  bookedNo: "Không có trong sổ",
  variance: "Chênh lệch",
  adjustment: "Điều chỉnh",
  shortage: "Thiếu thùng",
  surplus: "Thừa thùng",
  noVariance: "Khớp",
  lineState: {
    pending: "Chưa đếm",
    present: "Có mặt",
    missing: "Không thấy",
  },
  markMissing: "Không thấy",
  markMissingFor: (lpn: string) => `Báo không thấy thùng ${lpn}`,
  recountRequired: "Đã gửi đếm lại",
  // Hành động
  submit: "Nộp phiếu",
  submitDescription:
    "Nộp phiếu sẽ không tự sửa tồn. Mỗi thùng chênh lệch tạo một điều chỉnh COUNT_VARIANCE chờ quản lý kho duyệt.",
  submitBlocked: "Cần đếm hết mọi thùng trước khi nộp phiếu.",
  cancel: "Huỷ phiếu",
  cancelDescription: "Huỷ phiếu kiểm kê. Phiếu đã huỷ không mở lại được.",
  cancelReason: "Lý do huỷ",
  recount: "Yêu cầu đếm lại",
  recountColumn: "Đếm lại",
  recountDescription:
    "Mở một phiếu kiểm mù mới cho các dòng đã chọn. Phiếu này được giữ nguyên, không mở lại.",
  recountNote: "Ghi chú cho phiếu đếm lại",
  recountPick: (lpn: string) => `Chọn thùng ${lpn} để đếm lại`,
  recountHint: "Chỉ chọn được dòng có điều chỉnh bị từ chối.",
  back: "Quay lại",
  submitting: "Đang xử lý…",
  pendingAdjustments: "Xem điều chỉnh chờ duyệt",
} as const;

// Backend develop df34c338 ErrorCode.java. Never show the backend `message`: English prose, not a contract.
export const CYCLE_COUNT_ERROR_MESSAGES = {
  notOpen: "Phiếu kiểm kê đã nộp hoặc đã huỷ nên không đếm thêm được.",
  notAssignee: "Phiếu này đã giao cho người khác đếm.",
  countedByOther: "Dòng này đã được người khác đếm; chỉ người được giao mới đếm lại được.",
  notCounted: "Còn thùng chưa đếm. Đếm hết mọi thùng rồi nộp phiếu.",
  slotBusy: "Thùng này đang nằm trên một phiếu kiểm kê khác hoặc đang chờ duyệt chênh lệch.",
  stale: "Tồn kho đã thay đổi sau khi đếm. Đếm lại dòng được báo.",
  wrongLocation:
    "Không thêm được thùng này ở vị trí vừa quét. Báo quản lý kho để xử lý lệch vị trí.",
  cartonNotFound: "Không tìm thấy thùng có LPN này trong kho của phiếu.",
  cannotCount: "Không đếm được thùng này. Báo quản lý kho.",
  tooLarge: "Phiếu đã đủ 500 thùng, không thêm được nữa.",
  emptyScope: "Phạm vi kiểm kê không có thùng nào.",
  notFound: "Phiếu kiểm kê không tồn tại hoặc không thuộc kho bạn được xem.",
  outOfScope: "Bạn không có quyền với dữ liệu kiểm kê của kho này.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  validation: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  conflict: "Phiếu kiểm kê đã thay đổi. Dữ liệu mới nhất đã được tải lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
} as const;
