/**
 * Nhãn, thông báo và lỗi của module chuyển kho liên kho (docs 10, BE SCRUM-326/327).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.transfer` / `TOAST_MESSAGES.transfer` trỏ về đây.
 */

import { TRANSFER_LIMITS } from "./numbers";

import type { DeliveryMode, TransferReason } from "./statuses";

export const TRANSFER_UI_LABELS = {
  pageTitle: "Chuyển kho liên kho",
  subtitle: "Lập lệnh chuyển hàng giữa các kho, duyệt, lấy hàng và xuất kho tại kho nguồn.",
  createTitle: "Tạo lệnh chuyển kho",
  listCaption: "lệnh chuyển kho",
  editTitle: "Sửa lệnh chuyển kho",
  notFoundTitle: "Không tìm thấy lệnh chuyển kho",
  notFoundDescription: "Lệnh chuyển kho không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với lệnh chuyển kho.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu lệnh chuyển kho. Liên hệ quản trị để được cấp.",
  action: {
    create: "Tạo lệnh chuyển",
    edit: "Sửa nháp",
    submit: "Gửi duyệt",
    approve: "Duyệt",
    reject: "Từ chối",
    startPicking: "Bắt đầu lấy hàng",
    cancelPicking: "Dừng lấy hàng",
    dispatch: "Xuất kho",
    cancel: "Huỷ lệnh",
    save: "Lưu nháp",
    addLine: "Thêm dòng",
    // SCRUM-287 PR F9: lệnh nguyên chuyến (FTL) đi qua đóng gói chuyển kho và kế hoạch xe
    packTransfer: "Đóng gói chuyển kho",
    viewPacking: "Xem đóng gói",
    planVehicle: "Lập kế hoạch xe",
  },
  /** SCRUM-287 PR F9 (LP2-8): hình thức giao của lệnh, đóng gói và kế hoạch xe. */
  deliveryMode: {
    label: "Hình thức giao",
    hint: "Nguyên xe (FTL): đóng gói tại kho nguồn, lập kế hoạch xe và xuất kho khi xe cuối bàn giao. Giao lẻ: xuất kho thủ công như trước.",
    editableOnlyInDraft: "Chỉ đổi được hình thức giao khi lệnh còn Nháp.",
    packedAt: "Đóng gói xong lúc",
    goodsLeftAt: "Hàng rời kho lúc",
    notPacked: "Chưa đóng gói",
    notLeft: "Chưa rời kho",
    /** Thay cho nút Xuất kho của lệnh nguyên chuyến (BE 409 `TRANSFER_DISPATCH_BY_LOAD_PLAN`). */
    dispatchByLoadPlan:
      "Lệnh nguyên chuyến không xuất kho thủ công: hàng được xuất khi xe cuối cùng của kế hoạch xe được bàn giao.",
    packFirst: "Đóng gói xong lệnh rồi mới lập được kế hoạch xe.",
    planVehicleHint: "Đã đóng gói xong — lập kế hoạch xe để xếp hàng lên xe.",
    goodsLeftCannotCancelPicking: "Hàng đã rời kho nguồn trên xe — không dừng lấy hàng được nữa.",
  },
  disabledReason: {
    // Người gửi duyệt không tự duyệt / từ chối — four-eyes (docs 10 §2: Approver phê duyệt TO; BE TransferOrder TRANSFER_SELF_APPROVAL / ck_transfer_order_four_eyes)
    selfApproval: "Bạn là người gửi duyệt — cần người khác duyệt.",
  },
  noActions: {
    viewOnly: "Bạn chỉ có quyền xem lệnh chuyển kho.",
    // docs 10 §2: Approver là QUYỀN duyệt, không phải chức danh
    pendingApproval: "Đang chờ người có quyền duyệt.",
    inTransit: "Hàng đã rời kho nguồn — chờ kho đích nhận hàng.",
    // docs 10 §5: Partially Received = kho đích nhận một phần; Received = nhận đủ, chờ putaway
    partiallyReceived: "Kho đích đã nhận một phần — chờ nhận nốt hoặc đóng lệnh.",
    received: "Kho đích đã nhận đủ — chờ cất hàng (putaway).",
    terminal: "Lệnh đã kết thúc — không còn thao tác.",
  },
  // Rescope 2026-10-06 (SCRUM-327): không theo dõi hành trình
  noTracking:
    "Hệ thống không theo dõi hành trình (không mã vận đơn, không GPS). Trạng thái đổi khi kho đích nhận hàng.",
  reloadedNotice:
    "Lệnh vừa được người khác thay đổi — form đã nạp lại bản mới nhất, thay đổi chưa lưu của bạn đã bị bỏ. Vui lòng nhập lại.",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  warehouseSelect: {
    loading: "Đang tải danh sách kho…",
    loadFailed: "Không tải được danh sách kho.",
    empty: "Chưa có kho nào đang hoạt động.",
    inactive: "đã ngừng hoạt động",
  },
  you: "Bạn",
  linesCaption: "Dòng hàng của lệnh",
  totalRequested: "Tổng SL yêu cầu",
  totalShipped: "Tổng SL đã xuất",
  unit: "đơn vị",
  autoApproveHint: "Tổng SL không vượt ngưỡng duyệt thì gửi là được duyệt ngay",
  partialDispatch: "Có dòng xuất thiếu so với SL yêu cầu — phần thiếu không đi theo lệnh này.",
  sectionInfo: "Thông tin lệnh",
  sectionLines: "Dòng hàng",
  sectionTimeline: "Mốc thời gian",
  empty: {
    noDataTitle: "Chưa có lệnh chuyển kho",
    noDataDescription: "Chưa có lệnh chuyển hàng nào giữa các kho.",
    noDataAction: "Tạo lệnh chuyển đầu tiên",
    noResultsDescription: "Không có lệnh chuyển kho nào khớp từ khoá hoặc bộ lọc hiện tại.",
  },
  sameWarehouseHint: "Di chuyển trong cùng một kho dùng màn Di chuyển nội bộ (module 11).",
  field: {
    fromWarehouse: "Kho nguồn",
    toWarehouse: "Kho đích",
    sku: "SKU",
    lot: "Lô",
    quantity: "SL",
    requested: "Yêu cầu",
    all: "Tất cả",
    reason: "Lý do chuyển",
    noReason: "Không chọn",
    expectedDate: "Ngày dự kiến tới",
    selectWarehouse: "Chọn kho",
    remove: "Xoá",
    /** aria-label từng ô của dòng: "<nhãn> dòng <số>". */
    lineSuffix: "dòng",
    searchScope: "Số lệnh chuyển",
  },
  column: {
    number: "Số lệnh",
    expectedDate: "Ngày dự kiến",
    dispatchedAt: "Thời điểm xuất",
    createdAt: "Ngày tạo",
    status: "Trạng thái",
    actions: "Thao tác",
    requested: "SL yêu cầu",
    shipped: "SL đã xuất",
    short: "Thiếu",
  },
  refetching: "Đang tải lại danh sách lệnh chuyển kho",
  dispatchTitle: "Xuất kho",
  dispatchDescription:
    "Nhập số lượng thực xuất từng dòng. Tồn kho nguồn giảm, hàng chuyển sang trạng thái đang vận chuyển tới kho đích.",
  backToDetail: "Về chi tiết lệnh",
  /** Mô tả dialog xác nhận thao tác (nhận số lệnh). */
  confirm: {
    submit: (number: string) =>
      `Gửi ${number} đi duyệt. Tổng SL không vượt ngưỡng ${TRANSFER_LIMITS.approvalThresholdUnits} đơn vị thì được duyệt ngay; sau khi gửi không sửa được dòng hàng.`,
    approve: (number: string) => `Duyệt ${number}. Kho nguồn có thể bắt đầu lấy hàng.`,
    reject: (number: string) => `Trả ${number} về nháp để người lập sửa lại.`,
    startPicking: (number: string) => `Bắt đầu lấy hàng cho ${number} tại kho nguồn.`,
    cancelPicking: (number: string) => `Dừng lấy hàng — ${number} quay về Đã duyệt.`,
    cancel: (number: string) =>
      `Huỷ ${number}? Chỉ huỷ được lệnh Nháp hoặc Đã duyệt (chưa lấy hàng); không thể khôi phục.`,
    rejectReason: "Lý do từ chối",
    cancelReason: "Lý do huỷ",
  },
  viewDetail: "Xem chi tiết",
  searchPlaceholder: "Tìm theo số lệnh chuyển (TO-…)",
} as const;

/** BE `TransferDeliveryMode` (LP2-8). */
export const TRANSFER_DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  PARCEL: "Giao lẻ",
  FULL_TRUCKLOAD: "Nguyên xe (FTL)",
};

export const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  REBALANCING: "Cân bằng tồn",
  DEMAND: "Theo nhu cầu",
  CAMPAIGN: "Chiến dịch",
  OVERFLOW: "Kho đầy",
  OTHER: "Khác",
};

export const TRANSFER_TOAST_MESSAGES = {
  created: "Đã tạo lệnh chuyển kho",
  updated: "Đã lưu lệnh chuyển kho",
  submitted: "Đã gửi duyệt lệnh chuyển kho",
  submittedApproved: "Lệnh không vượt ngưỡng duyệt — đã được duyệt ngay",
  approved: "Đã duyệt lệnh chuyển kho",
  rejected: "Đã trả lệnh về nháp",
  pickingStarted: "Đã bắt đầu lấy hàng",
  pickingCancelled: "Đã dừng lấy hàng",
  dispatched: "Đã xuất kho — hàng đang vận chuyển",
  cancelled: "Đã huỷ lệnh chuyển kho",
} as const;

/** errorCode BE (common/error/ErrorCode.java) → câu tiếng Việt. BE trả detail tiếng Anh. */
export const TRANSFER_ERROR_MESSAGES = {
  INSUFFICIENT_STOCK: "Kho nguồn không đủ hàng khả dụng cho một số dòng.",
  // Không khẳng định "đã tải lại": lần tải lại có thể thất bại (khi đó có thông báo riêng)
  INVALID_TRANSFER_TRANSITION:
    "Trạng thái lệnh đã thay đổi ở nơi khác — thao tác chưa được thực hiện.",
  TRANSFER_SELF_APPROVAL: "Người gửi duyệt không được tự duyệt hoặc từ chối lệnh của mình.",
  TRANSFER_ORDER_NOT_EDITABLE: "Chỉ sửa được lệnh ở trạng thái Nháp.",
  OPTIMISTIC_LOCK: "Lệnh vừa được người khác sửa — thao tác chưa được lưu.",
  // SCRUM-287 PR F9 (BE PR #164)
  TRANSFER_DISPATCH_BY_LOAD_PLAN:
    "Lệnh nguyên chuyến được xuất khi xe cuối cùng của kế hoạch xe bàn giao — không xuất kho thủ công.",
  TRANSFER_GOODS_LEFT: "Hàng của lệnh đã rời kho nguồn trên xe nên không dừng lấy hàng được nữa.",
  LOAD_PLAN_LOADING_STARTED:
    "Một xe của kế hoạch xe đã bắt đầu xếp hàng nên chưa dừng lấy hàng được. Đợi xe xong hoặc dỡ hàng trước.",
  TRANSFER_NOT_FULL_TRUCKLOAD: "Lệnh này giao lẻ nên không đóng gói để lập kế hoạch xe.",
  TRANSFER_NOT_PACKED: "Lệnh chuyển kho chưa đóng gói xong để lập kế hoạch xe.",
  WAREHOUSE_INACTIVE: "Kho nguồn hoặc kho đích đang ngừng hoạt động.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho đã chọn.",
  TRANSFER_ORDER_NOT_FOUND: "Không tìm thấy lệnh chuyển kho.",
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho liên quan đến lệnh này.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ — kiểm tra lại các ô được đánh dấu.",
  validationGeneral:
    "Máy chủ từ chối dữ liệu của lệnh — kiểm tra lại kho nguồn / đích và các dòng.",
  validationDispatch: "Máy chủ từ chối số lượng xuất — kiểm tra lại SL từng dòng.",
  LOCK_TIMEOUT: "Tồn kho đang được thao tác ở nơi khác — đợi vài giây rồi thử lại.",
  INVENTORY_POLICY_STOCK_CONFLICT:
    "Tồn của SKU chưa khớp chính sách xuất (FIFO/FEFO) — liên hệ quản lý kho kiểm tra lại tồn.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  MALFORMED_REQUEST: "Yêu cầu gửi lên không hợp lệ — tải lại trang rồi thử lại.",
  UNSUPPORTED_PARAMETER: "Tham số lọc không hợp lệ — bỏ bộ lọc rồi thử lại.",
  generic: "Không thực hiện được thao tác với lệnh chuyển kho. Thử lại sau.",
} as const;

export const TRANSFER_FIELD_MESSAGES = {
  fromRequired: "Chọn kho nguồn",
  toRequired: "Chọn kho đích",
  sameWarehouse: "Kho đích phải khác kho nguồn",
  skuRequired: "Nhập SKU",
  skuFormat: "SKU 1–64 ký tự gồm chữ, số, '.', '_', '-', bắt đầu bằng chữ hoặc số",
  quantity: "SL là số nguyên từ 1",
  quantityMax: "SL tối đa 1.000.000",
  duplicateLine: "Trùng SKU và lô với dòng khác — gộp vào một dòng",
  linesRequired: "Cần ít nhất một dòng hàng",
  linesTooMany: "Tối đa 200 dòng",
  tooLong: "Quá dài",
  reasonRequired: "Nhập lý do",
  shippedRange: "SL xuất từ 0 đến SL yêu cầu",
  shippedTotal: "Phải xuất ít nhất 1 đơn vị",
  notEnoughStock: "Kho nguồn không đủ — khả dụng",
  notEnoughStockNoQty: "Kho nguồn không đủ hàng cho SKU này",
} as const;
