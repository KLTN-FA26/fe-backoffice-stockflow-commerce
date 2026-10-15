import { SHARED_QUERY_ROOTS } from "./query-roots";

// Wire contract: backend develop 1de8f426, SCRUM-424 / StockOperationsController.
export const INVENTORY_API = {
  adjustments: "/inventory/adjustments",
  adjustment: (id: string) => `/inventory/adjustments/${encodeURIComponent(id)}`,
  approval: (id: string) => `/inventory/adjustments/${encodeURIComponent(id)}/approval`,
  rejection: (id: string) => `/inventory/adjustments/${encodeURIComponent(id)}/rejection`,
  withdrawal: (id: string) => `/inventory/adjustments/${encodeURIComponent(id)}/withdrawal`,
  movements: "/inventory/movements",
} as const;

export const INVENTORY_QUERY_KEYS = {
  adjustments: "inventory-stock-adjustments",
  movements: "inventory-stock-movements",
  stock: SHARED_QUERY_ROOTS.inventoryStock,
} as const;

export const STOCK_ADJUSTMENT_REASONS = [
  "DAMAGED",
  "LOST",
  "FOUND",
  "EXPIRED",
  "DATA_CORRECTION",
  "SCRAP",
  "SAMPLE",
  "OTHER",
] as const;

export const STOCK_ADJUSTMENT_REASON = {
  OTHER: "OTHER",
  SAMPLE: "SAMPLE",
  SCRAP: "SCRAP",
} as const;

// Backend develop 0f18f24 StockMovement.MovementType — the values GET /movements?type= accepts.
// Responses carry `type` as a String and may hold values newer than this list.
export const STOCK_MOVEMENT_TYPES = [
  "RECEIPT",
  "MOVE",
  "ADJUSTMENT",
  "TRANSFER_OUT",
  "STATUS_CHANGE",
  "PICK",
  "PUT_BACK",
] as const;
export const STOCK_ADJUSTMENT_ACTION = {
  APPROVE: "approve",
  REJECT: "reject",
  WITHDRAW: "withdraw",
} as const;

export const INVENTORY_LIMITS = {
  delta: 1_000_000,
  locationLength: 64,
  lotLength: 64,
  noteLength: 1000,
  rejectionLength: 500,
  skuMaxLength: 64,
  skuMinLength: 3,
} as const;

export const INVENTORY_MESSAGES = {
  invalidContract: "Dữ liệu tồn kho trả về không đúng định dạng.",
  required: "Trường bắt buộc",
  nonzeroDelta: "Số lượng điều chỉnh phải khác 0.",
  writeDown: "Phế phẩm và làm mẫu chỉ được giảm tồn kho.",
  otherNote: "Cần giải thích khi chọn lý do khác.",
  invalidSku: "SKU phải gồm 3–64 ký tự chữ, số hoặc dấu gạch ngang.",
  requestFailed: "Không thực hiện được yêu cầu tồn kho.",
} as const;

export const INVENTORY_ROUTES = {
  movements: "/admin/movements",
  adjustments: "/admin/inventory/adjustments",
  createAdjustment: "/admin/inventory/adjustments/create",
  adjustment: (id: string) => `/admin/inventory/adjustments/${encodeURIComponent(id)}`,
} as const;

export const INVENTORY_STORAGE_KEYS = {
  movements: "stockflow:admin:movements:config",
  adjustments: "stockflow:admin:inventory:adjustments:config",
} as const;

export const INVENTORY_PAGE_SIZES = [10, 15, 20, 50] as const;
export const INVENTORY_LABELS = {
  movementTitle: "Lịch sử biến động tồn kho",
  movementSubtitle: "Sổ kho theo SKU và vị trí — số lượng theo đơn vị cơ sở của SKU.",
  adjustmentTitle: "Điều chỉnh tồn kho",
  createAdjustment: "Tạo điều chỉnh",
  adjustmentDetail: "Chi tiết điều chỉnh",
  adjustmentNumber: "Mã điều chỉnh",
  adjustmentReason: "Lý do điều chỉnh",
  quantityDelta: "Chênh lệch số lượng",
  status: "Trạng thái",
  requestedAt: "Ngày yêu cầu",
  requestedBy: "Người yêu cầu",
  decidedBy: "Người quyết định",
  decidedAt: "Thời điểm quyết định",
  postedAt: "Thời điểm ghi sổ",
  withdrawnAt: "Thời điểm rút yêu cầu",
  note: "Giải thích",
  noAdjustments: "Chưa có điều chỉnh tồn kho",
  noAdjustmentsDescription: "Tạo yêu cầu điều chỉnh và chuyển cho người duyệt.",
  approvalPolicy: "Mọi điều chỉnh cần người khác phê duyệt trước khi cập nhật tồn kho.",
  approve: "Duyệt và ghi sổ",
  reject: "Từ chối điều chỉnh",
  withdraw: "Rút yêu cầu",
  submitAdjustment: "Gửi yêu cầu điều chỉnh",
  submitting: "Đang xử lý…",
  chooseReason: "Chọn lý do",
  back: "Quay lại danh sách",
  approveDescription: "Phê duyệt sẽ cập nhật số lượng tồn và ghi nhận một biến động kho.",
  rejectDescription: "Nhập lý do từ chối yêu cầu điều chỉnh.",
  withdrawDescription: "Rút yêu cầu đang chờ duyệt. Số lượng tồn chưa được thay đổi.",
  rejectionReason: "Lý do từ chối",
  cancel: "Quay lại",
  sku: "SKU",
  location: "Vị trí",
  movementType: "Loại biến động",
  all: "Tất cả",
  apply: "Áp dụng bộ lọc",
  reset: "Bỏ bộ lọc",
  noMovements: "Chưa có biến động tồn kho",
  noMovementsDescription: "Các giao dịch nhập, chuyển và điều chỉnh sẽ xuất hiện trong sổ kho.",
  noResults: "Không tìm thấy kết quả",
  noResultsDescription: "Thử thay đổi SKU, vị trí hoặc bộ lọc.",
  loadError: "Không tải được dữ liệu tồn kho",
  retry: "Thử lại",
  denied: "Bạn không có quyền xem tồn kho",
  deniedDescription: "Liên hệ quản trị viên để được cấp quyền phù hợp.",
  fetching: "Đang cập nhật dữ liệu",
  trace: "Mã tra cứu",
  perPage: "Dòng/trang",
  previous: "Trang trước",
  next: "Trang sau",
  showing: "Hiển thị",
  page: "Trang",
  occurredAt: "Thời điểm",
  fromLocation: "Từ vị trí",
  toLocation: "Đến vị trí",
  quantity: "Số lượng",
  lot: "Lô",
  reference: "Chứng từ nguồn",
  reason: "Lý do",
  missing: "—",
  filtered: "Đang áp dụng bộ lọc",
  offline: "Mất kết nối — thay đổi chưa được lưu.",
} as const;

export const STOCK_MOVEMENT_LABELS = {
  RECEIPT: "Nhập hàng",
  MOVE: "Chuyển vị trí",
  ADJUSTMENT: "Điều chỉnh",
  TRANSFER_OUT: "Xuất điều chuyển",
  STATUS_CHANGE: "Đổi trạng thái tồn",
  PICK: "Lấy hàng",
  PUT_BACK: "Trả hàng về vị trí",
} as const satisfies Record<(typeof STOCK_MOVEMENT_TYPES)[number], string>;
