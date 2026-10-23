/**
 * Nhãn, thông báo và lỗi của màn Kế hoạch xếp xe (SCRUM-287 PR F4, BE PR #161 `LoadPlanController`).
 * `UI_LABELS.loadPlan` / `TOAST_MESSAGES.loadPlan` trỏ về đây. Nhãn khung 3D và bảng xếp hàng nằm ở
 * `labels-load-planning.ts`.
 */

import { LOAD_PLAN_EDITOR_LABELS } from "./labels-load-plan-editor";
import {
  LOAD_PLAN_SOURCE_LABELS,
  LOAD_PLAN_TRANSFER_ERROR_MESSAGES,
  LOAD_PLAN_TRANSFER_FIELD_MESSAGES,
  LOAD_PLAN_TRANSFER_LABELS,
} from "./labels-load-plan-transfer";
import { LOAD_PLAN_LIMITS } from "./numbers";

import type {
  LoadPlanEstimateFlag,
  LoadPlanSelectionMode,
  LoadPlanStatus,
  LoadPlanUnplacedReason,
} from "./statuses";

/** BE `LoadPlanStatus` — hiển thị đúng ngữ nghĩa docs 09 §5. */
export const LOAD_PLAN_STATUS_LABELS: Record<LoadPlanStatus, string> = {
  DRAFT: "Bản nháp",
  PLANNED: "Đã tính xếp",
  CONFIRMED: "Đã chốt",
  DISPATCHED: "Đã xuất xe",
  CANCELLED: "Đã huỷ",
};

/** BE `SelectionMode` (LP-6) kèm câu giải thích dưới ô chọn. */
export const LOAD_PLAN_MODE_LABELS: Record<LoadPlanSelectionMode, string> = {
  SINGLE_TYPE: "Một loại xe",
  FEWEST_VEHICLES: "Ít xe nhất",
};

export const LOAD_PLAN_MODE_HINTS: Record<LoadPlanSelectionMode, string> = {
  SINGLE_TYPE: "Chọn loại xe xếp tốt nhất rồi dùng bao nhiêu xe loại đó tuỳ cần.",
  FEWEST_VEHICLES: "Trộn các loại xe đã chọn sao cho tổng số xe ít nhất.",
};

/** Lý do một kiện chưa xếp được (BE `LoadPlanUnplacedReason`). */
export const LOAD_PLAN_UNPLACED_REASON_LABELS: Record<LoadPlanUnplacedReason, string> = {
  TOO_LARGE: "Quá lớn: không loại xe nào đã chọn chứa nổi",
  TOO_HEAVY: "Quá nặng so với tải trọng xe",
  NO_VEHICLE_AVAILABLE: "Hết xe của loại phù hợp",
  NO_SPACE: "Không còn chỗ trên xe",
  SEARCH_CUT_OFF: "Dừng do hết thời gian tính",
  MANUAL: "Được bỏ ra khỏi xe thủ công",
};

/** Cờ so với ước lượng (`vsEstimate.flags`) — chỉ để tham khảo. */
export const LOAD_PLAN_ESTIMATE_FLAG_LABELS: Record<LoadPlanEstimateFlag, string> = {
  NO_ESTIMATE: "Có đơn chưa có ước lượng nên không so được",
  ESTIMATE_INCOMPLETE: "Ước lượng bỏ sót dòng hàng vì thiếu kích thước",
  ESTIMATE_UNPLACED: "Chính ước lượng cũng không xếp hết thùng",
  MORE_VEHICLES: "Dùng nhiều xe hơn ước lượng",
  FEWER_VEHICLES: "Dùng ít xe hơn ước lượng",
  MORE_PARCELS: `Nhiều kiện hơn ước lượng (trên ${LOAD_PLAN_LIMITS.estimateTolerancePct}%)`,
  FEWER_PARCELS: `Ít kiện hơn ước lượng (quá ${LOAD_PLAN_LIMITS.estimateTolerancePct}%)`,
  VOLUME_ABOVE: `Thể tích vượt ước lượng trên ${LOAD_PLAN_LIMITS.estimateTolerancePct}%`,
  WEIGHT_ABOVE: `Khối lượng vượt ước lượng trên ${LOAD_PLAN_LIMITS.estimateTolerancePct}%`,
};

export const LOAD_PLAN_UI_LABELS = {
  /** Trình soạn xếp tay (PR F5). */
  editor: LOAD_PLAN_EDITOR_LABELS,
  /** Kế hoạch cho lệnh chuyển kho (PR F9, LP-9). */
  transfer: LOAD_PLAN_TRANSFER_LABELS,
  source: LOAD_PLAN_SOURCE_LABELS,
  pageTitle: "Kế hoạch xếp xe",
  navTooltip: "Load planning",
  create: "Lập kế hoạch xếp xe",
  searchPlaceholder: "Tìm theo mã kế hoạch",
  statusFilter: "Trạng thái",
  warehouseFilter: "Kho",
  summarySearch: "Search chính",
  all: "Tất cả",
  clearFilters: "Bỏ bộ lọc",
  listCaption: "kế hoạch",
  refetching: "Đang tải lại danh sách kế hoạch",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  loadFailedTitle: "Không tải được danh sách kế hoạch",
  noReadTitle: "Bạn không có quyền xem kế hoạch xếp xe",
  noReadDescription: "Tài khoản của bạn chưa được cấp quyền đọc kế hoạch xếp xe.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền truy cập kế hoạch xếp xe.",
  noCreateTitle: "Bạn không có quyền lập kế hoạch xếp xe",
  noCreateDescription: "Cần quyền xem và lập kế hoạch xếp xe. Liên hệ quản lý kho để được cấp.",
  notFoundTitle: "Không tìm thấy kế hoạch xếp xe",
  notFoundDescription: "Kế hoạch không tồn tại, hoặc nằm ngoài kho bạn phụ trách.",
  empty: {
    noDataTitle: "Chưa có kế hoạch xếp xe",
    noDataDescription: "Lập kế hoạch từ các lô giao nguyên xe đang chờ xuất.",
    noResultsDescription: "Không có kế hoạch nào khớp bộ lọc hiện tại.",
  },
  column: {
    code: "Mã kế hoạch",
    status: "Trạng thái",
    mode: "Chế độ",
    shipments: "Lô giao",
    vehicles: "Số xe",
    packages: "Số kiện",
    unplaced: "Chưa xếp",
    createdAt: "Tạo lúc",
  },
  createForm: {
    title: "Lập kế hoạch xếp xe",
    back: "Về danh sách",
    warehouse: "Kho",
    warehousePlaceholder: "Chọn kho",
    shipmentsTitle: "Lô giao nguyên xe chờ xuất",
    shipmentsHint:
      "Chọn nguyên lô: kế hoạch lấy mọi kiện của lô mà chưa kế hoạch nào khác giữ (LP-5).",
    shipmentsEmpty: "Kho này chưa có lô giao nguyên xe nào đang chờ xuất.",
    pickWarehouseFirst: "Chọn kho để xem các lô giao nguyên xe đang chờ xuất.",
    candidatesFailed: "Không tải được danh sách lô giao.",
    selectAll: "Chọn tất cả",
    clearAll: "Bỏ chọn",
    shipmentCode: "Lô giao",
    order: "Đơn hàng",
    packageCount: "Số kiện",
    weight: "Khối lượng",
    volume: "Thể tích",
    readyAt: "Sẵn sàng lúc",
    partialAllowed: "Cho giao một phần",
    partialNotAllowed: "Phải đi đủ cả đơn",
    inOtherPlans: (count: number) => `${count} kiện đang ở kế hoạch khác`,
    selectedSummary: (shipments: number, packages: number) =>
      `Đã chọn ${shipments} lô · ${packages} kiện`,
    vehicleTypesTitle: "Loại xe",
    vehicleTypesHint: "Chọn các loại xe được dùng; số xe tối đa của mỗi loại là số xe sẵn có.",
    vehicleTypesFailed: "Không tải được danh mục loại xe.",
    vehicleTypesEmpty: "Chưa có loại xe nào đang dùng.",
    availableCount: (count: number) => `${count} xe sẵn có`,
    modeTitle: "Chế độ chọn xe",
    note: "Ghi chú",
    notePlaceholder: "Ghi chú cho kế hoạch (không bắt buộc)",
    submit: "Tạo và tính xếp xe",
    submitting: "Đang tính xếp xe…",
    errorTitle: "Chưa lập được kế hoạch",
    calcFailed: (message: string) =>
      `Đã tạo kế hoạch nhưng chưa tính được xếp xe: ${message} Mở kế hoạch để tính lại.`,
  },
  detail: {
    general: "Thông tin chung",
    code: "Mã kế hoạch",
    status: "Trạng thái",
    warehouse: "Kho",
    /** Không tra được tên kho (danh mục kho bị từ chối) — không hiện UUID. */
    unknownWarehouse: "—",
    mode: "Chế độ chọn xe",
    shipments: "Lô giao",
    vehicleTypes: "Loại xe cho phép",
    createdAt: "Tạo lúc",
    calculatedAt: "Tính lúc",
    confirmedAt: "Chốt lúc",
    reopenedAt: "Mở lại lúc",
    cancelledAt: "Huỷ lúc",
    dispatchedAt: "Xuất xe lúc",
    reason: "Lý do",
    note: "Ghi chú",
    notCalculated: "Chưa tính",
    dispatchLoad: "Chuyến xe",
    refetchFailed: "Không tải lại được kế hoạch — đang hiện bản đã tải trước đó.",
    viewOnly: "Bạn chỉ có quyền xem kế hoạch này.",
    dismiss: "Đóng",
    finalState: "Kế hoạch đã kết thúc, chỉ còn xem.",
    noVehicles: "Chưa có xe nào: tính xếp xe để xem bố cục.",
    layoutsFailed: "Không tải được bố cục xếp xe.",
    tabs: { loading: "Xếp xe", reconciliation: "Đối chiếu" },
    tabsAria: "Nội dung kế hoạch",
    actions: {
      calculate: "Tính xếp xe",
      recalculate: "Tính lại xe",
      editInputs: "Đổi đầu vào",
      confirm: "Chốt kế hoạch",
      reopen: "Mở lại",
      cancel: "Huỷ kế hoạch",
      acknowledge: "Để lại các kiện chưa xếp",
    },
    needsRecalculation: "Cần tính lại",
    needsRecalculationAlert: "Có xe vừa bị bỏ kiện (đơn bị huỷ): tính lại xe đó trước khi chốt.",
    vehicleSwitcher: "Chọn xe",
    vehicleTitle: (seq: number, code: string) => `Xe #${seq} · ${code}`,
    vehicleFill: "Lấp đầy thể tích",
    vehicleWeightFill: "Tải trọng",
    vehicleParcels: "Số kiện",
    dispatchLoadOf: (code: string) => `Chuyến ${code}`,
    unplaced: {
      title: "Kiện chưa xếp",
      empty: "Mọi kiện đã được xếp lên xe.",
      acknowledged: "Đã xác nhận để lại các kiện này ở khu chờ xuất.",
      pending: "Cần xác nhận để lại các kiện này trước khi chốt (BR-13).",
      parcel: "Kiện",
      dimensions: "D×R×C (cm)",
      weight: "Khối lượng (kg)",
      reasonColumn: "Lý do",
      selectToReturn: "Chọn để đưa lại vào xe",
      returnToVehicle: (seq: number) => `Đưa lại vào xe #${seq}`,
      returnHint: "Tính lại riêng xe đang xem, thêm các kiện đã chọn ở khay.",
      kitNote: "Một kiện của bộ kéo theo cả bộ.",
    },
    reconciliation: {
      pieceCheck: "Đối chiếu số kiện",
      pieceCheckHint:
        "Số kiện kế hoạch giữ = đã xếp + chưa xếp; kiện bị để lại khi chốt tính riêng.",
      balanced: "Khớp",
      unbalanced: "Lệch",
      scopePlan: "Toàn kế hoạch",
      scopeShipment: "Theo lô giao",
      scopeOrder: "Theo đơn hàng",
      packagesIn: "Kiện trong kế hoạch",
      placed: "Đã xếp",
      unplaced: "Chưa xếp",
      leftBehind: "Để lại khi chốt",
      notInPlan: "Ngoài kế hoạch",
      vsEstimate: "So với ước lượng",
      advisory: "Chỉ để tham khảo, không chặn việc chốt kế hoạch.",
      noEstimate: "Chưa có ước lượng nào để so (cờ chưa tính được).",
      noFlags: "Không có chênh lệch đáng kể so với ước lượng.",
      notEstimated: (count: number) => `${count} đơn chưa có ước lượng, không nằm trong phép so`,
      vehiclesByType: "Số xe theo loại",
      vehiclesNotCompared:
        "Kế hoạch có nhiều đơn: số xe không so được, chỉ liệt kê số xe mỗi ước lượng cần.",
      estimated: "Ước lượng",
      actual: "Thực tế",
      delta: "Chênh",
      volume: "Thể tích",
      weight: "Khối lượng",
      cartons: "Thùng theo dòng hàng",
      orderEstimates: "Ước lượng theo đơn",
      line: "Dòng hàng",
      type: "Loại xe",
      order: "Đơn",
    },
  },
  dialog: {
    calculate: {
      title: "Tính xếp xe",
      description:
        "Chạy bộ xếp xe cho cả kế hoạch. Nếu đã có bố cục (kể cả chỉnh tay), kết quả mới sẽ thay thế nó.",
      confirm: "Tính xếp xe",
    },
    acknowledge: {
      title: "Để lại các kiện chưa xếp",
      description:
        "Các kiện chưa xếp sẽ ở lại khu chờ xuất và trở về danh sách lô giao khi chốt kế hoạch (BR-13). Đơn không cho giao một phần sẽ bị từ chối (LP-4).",
      confirm: "Xác nhận để lại",
    },
    confirm: {
      title: "Chốt kế hoạch",
      description:
        "Khoá kiện và bố cục, tạo mỗi xe một chuyến chờ đặt xe. Các kiện chưa xếp quay về khu chờ xuất.",
      confirm: "Chốt kế hoạch",
    },
    reopen: {
      title: "Mở lại kế hoạch",
      description:
        "Đưa kế hoạch về trạng thái đã tính xếp và huỷ các chuyến xe đã tạo cho nó (kể cả chuyến đã đặt xe). Chỉ làm được khi chưa xe nào bắt đầu xếp hàng (BR-14).",
      confirm: "Mở lại",
      reason: "Lý do mở lại",
    },
    cancel: {
      title: "Huỷ kế hoạch",
      description:
        "Các kiện trở về khu chờ xuất và các chuyến xe đã tạo bị huỷ. Chỉ làm được khi chưa xe nào bắt đầu xếp hàng (BR-14).",
      confirm: "Huỷ kế hoạch",
      reason: "Lý do huỷ",
    },
    editInputs: {
      title: "Đổi đầu vào kế hoạch",
      description:
        "Đổi lô giao, loại xe hoặc chế độ. Kế hoạch đã tính sẽ về bản nháp và bỏ các xe hiện có; cần tính xếp xe lại.",
      confirm: "Lưu đầu vào",
      inactiveDropped: (codes: string) =>
        `Loại xe ${codes} đã ngừng dùng nên không còn trong lựa chọn; chọn loại xe khác nếu cần.`,
    },
    keepOpen: "Quay lại",
  },
} as const;

export const LOAD_PLAN_TOAST_MESSAGES = {
  created: "Đã lập kế hoạch xếp xe",
  calculated: "Đã tính xếp xe",
  vehicleRecalculated: "Đã tính lại xe",
  inputsSaved: "Đã lưu đầu vào kế hoạch",
  acknowledged: "Đã xác nhận để lại các kiện chưa xếp",
  confirmed: "Đã chốt kế hoạch",
  reopened: "Đã mở lại kế hoạch",
  cancelled: "Đã huỷ kế hoạch",
  placementsSaved: "Đã lưu bố cục xếp tay",
} as const;

/** Mã lỗi BE (`ErrorCode`, PR #161) → câu tiếng Việt. `generic` là câu dự phòng. */
export const LOAD_PLAN_ERROR_MESSAGES = {
  generic: "Không thực hiện được. Vui lòng thử lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  OPTIMISTIC_LOCK:
    "Người khác vừa thay đổi kế hoạch này. Đã tải lại dữ liệu mới nhất — kiểm tra rồi thử lại.",
  LOAD_PLAN_NOT_FOUND: "Không tìm thấy kế hoạch xếp xe.",
  LOAD_PLAN_VEHICLE_NOT_FOUND: "Xe này không còn trong kế hoạch. Đã tải lại dữ liệu mới nhất.",
  INVALID_LOAD_PLAN_TRANSITION:
    "Kế hoạch không làm được thao tác này ở trạng thái hiện tại. Đã tải lại dữ liệu mới nhất.",
  LOAD_PLAN_PACKAGE_TAKEN: "Một kiện của lô đã chọn đang nằm trong kế hoạch xếp xe khác.",
  LOAD_PLAN_PACKAGE_UNMEASURED:
    "Có kiện chưa có kích thước hoặc khối lượng: cân đo lại ở khâu đóng gói.",
  LOAD_PLAN_EMPTY: "Kế hoạch chưa có gì để tính hoặc chốt: chọn lô giao và loại xe trước.",
  LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED:
    "Hãy xác nhận để lại các kiện chưa xếp trước khi chốt kế hoạch.",
  LOAD_PLAN_NEEDS_RECALCULATION:
    "Có xe vừa bị bỏ kiện (đơn bị huỷ): tính lại xe đó trước khi chốt.",
  LOAD_PLAN_LOADING_STARTED:
    "Một xe của kế hoạch đã bắt đầu xếp hàng nên không mở lại hay huỷ được nữa.",
  PLACEMENT_RULE_VIOLATION:
    "Bố cục hiện có vi phạm quy tắc xếp hàng, nên chưa chốt được. Tính lại xe vi phạm.",
  PACKAGE_IN_LOAD_PLAN: "Kiện đang nằm trong kế hoạch xếp xe; bỏ kiện khỏi kế hoạch trước.",
  LOAD_MANAGED_BY_PLAN: "Chuyến xe này thuộc một kế hoạch xếp xe; thay đổi qua kế hoạch.",
  VEHICLE_TYPE_INACTIVE: "Có loại xe đã ngừng dùng: bỏ chọn loại đó rồi thử lại.",
  SHIPMENT_STATE_CONFLICT: "Có lô giao không còn chờ xuất. Tải lại danh sách lô rồi chọn lại.",
  SHIPMENT_NOT_FOR_LOAD: "Có lô giao không phải lô giao nguyên xe, hoặc thuộc kho khác.",
  ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED:
    "Đơn không cho giao một phần mà kế hoạch để lại một phần kiện của đơn: xếp đủ hoặc nhờ Sales cho phép giao một phần (LP-4).",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho đã chọn. Chọn lại kho.",
  VEHICLE_TYPE_NOT_FOUND: "Có loại xe không còn trong danh mục: bỏ chọn loại đó rồi thử lại.",
  SHIPMENT_NOT_FOUND: "Có lô giao không còn tồn tại: tải lại danh sách lô rồi chọn lại.",
  CONFLICT:
    "Mã yêu cầu này đã dùng cho một kế hoạch khác (kho hoặc nội dung khác). Bấm thử lại để gửi với mã mới.",
  OUT_OF_DATA_SCOPE: "Kho này nằm ngoài phạm vi kho bạn phụ trách.",
  /** `VALIDATION_FAILED` kèm mã trường `LOAD_PLAN_PACKAGE_NOT_ON_TRAY`: kiện đã rời khay chưa xếp. */
  LOAD_PLAN_PACKAGE_NOT_ON_TRAY:
    "Có kiện không còn ở khay chưa xếp (vừa được xếp hoặc bị gỡ khỏi kế hoạch). Đã tải lại kế hoạch — chọn lại các kiện rồi thử lại.",
  VALIDATION_FAILED: "Dữ liệu gửi lên chưa hợp lệ.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  ...LOAD_PLAN_TRANSFER_ERROR_MESSAGES,
} as const;

/** Câu LP-4 nêu MỌI đơn vi phạm BE báo ở `fieldErrors[].orderNumber`. */
export const LOAD_PLAN_PARTIAL_SHIPMENT_ORDER = (orders: readonly string[]) =>
  `${orders.length > 1 ? "Các đơn" : "Đơn"} ${orders.join(", ")} không cho giao một phần mà kế hoạch để lại một phần kiện của ${orders.length > 1 ? "từng đơn" : "đơn"}: xếp đủ hoặc nhờ Sales cho phép giao một phần (LP-4).`;

/** Lỗi nhập ở form lập kế hoạch / lý do (zod). */
export const LOAD_PLAN_FIELD_MESSAGES = {
  warehouseRequired: "Chọn kho.",
  shipmentsRequired: "Chọn ít nhất một lô giao.",
  shipmentsTooMany: `Tối đa ${LOAD_PLAN_LIMITS.shipmentsMax} lô giao.`,
  vehicleTypesRequired: "Chọn ít nhất một loại xe.",
  vehicleTypesTooMany: `Tối đa ${LOAD_PLAN_LIMITS.vehicleTypesMax} loại xe.`,
  reasonRequired: "Nhập lý do.",
  reasonTooLong: `Lý do tối đa ${LOAD_PLAN_LIMITS.reasonMax} ký tự.`,
  noteTooLong: `Ghi chú tối đa ${LOAD_PLAN_LIMITS.noteMax} ký tự.`,
  packagesTooMany: `Tối đa ${LOAD_PLAN_LIMITS.addPackagesMax} kiện mỗi lần.`,
  ...LOAD_PLAN_TRANSFER_FIELD_MESSAGES,
} as const;
