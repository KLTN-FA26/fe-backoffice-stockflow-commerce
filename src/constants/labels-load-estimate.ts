/**
 * Nhãn tiếng Việt của "Ước tính xếp xe" (SCRUM-287 PR EST, BE PR #160): ngăn kéo tính thử một đơn xếp lên xe
 * nào trước khi đóng gói. LP2-1: chỉ để tham khảo — không chốt kế hoạch hay đặt xe từ ước tính này.
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó.
 */

import { LOAD_ESTIMATE_LIMITS } from "./numbers";

/** BE `LoadEstimateRequest.selectionMode` (mặc định SINGLE_TYPE). */
export const LOAD_ESTIMATE_SELECTION_MODES = ["SINGLE_TYPE", "FEWEST_VEHICLES"] as const;

export const LOAD_ESTIMATE_LABELS = {
  /** LP2-1 — luôn hiện cạnh kết quả. */
  advisory: "Ước tính — chỉ để tham khảo",
  advisoryHint:
    "Tính từ kích thước và khối lượng trong hồ sơ hàng tồn, chưa phải kích thước kiện thật; không dùng để chốt kế hoạch hay đặt xe.",
  open: "Ước tính xếp xe",
  title: "Ước tính xếp xe",
  subtitle: (orderNumber: string) => `Đơn ${orderNumber}`,
  selectWarehouseFirst: "Chọn kho trước khi ước tính.",
  noPermission: "Bạn không có quyền xem ước tính xếp xe.",
  controls: {
    vehicleTypes: "Loại xe được dùng",
    vehicleTypesHint: (max: number) => `Không chọn = mọi loại xe đang dùng. Tối đa ${max} loại.`,
    vehicleTypesLoading: "Đang tải loại xe…",
    vehicleTypesFailed: "Không tải được danh sách loại xe.",
    vehicleTypesEmpty: "Chưa có loại xe nào đang dùng.",
    selectionMode: "Cách chọn xe",
    modes: {
      SINGLE_TYPE: "Một loại xe",
      FEWEST_VEHICLES: "Ít xe nhất",
    },
    modeHints: {
      SINGLE_TYPE: "Dùng cùng một loại xe cho cả đơn.",
      FEWEST_VEHICLES: "Trộn nhiều loại xe để dùng ít xe nhất.",
    },
    run: "Ước tính",
    rerun: "Ước tính lại",
    running: "Đang tính…",
    tooManyTypes: `Chọn tối đa ${LOAD_ESTIMATE_LIMITS.vehicleTypesMax} loại xe.`,
  },
  current: {
    loading: "Đang tải ước tính hiện có…",
    loadFailed: "Không tải được ước tính hiện có.",
    retry: "Thử lại",
    none: "Đơn này chưa có ước tính. Chọn loại xe rồi bấm “Ước tính”.",
    createdAt: (when: string) => `Tính lúc ${when}`,
  },
  result: {
    metricsTitle: "Kết quả",
    vehicleSwitcher: "Chọn xe",
    vehicleTab: (seq: number, code: string) => `Xe #${seq} · ${code}`,
    noVehicles: "Không xếp được hàng nào lên xe.",
    /** `meta.budgetExhausted` hoặc có kiện SEARCH_CUT_OFF: lời giải tốt nhất tìm được trong thời gian cho phép. */
    budgetExhausted: "Dừng do hết thời gian tính",
    budgetExhaustedHint:
      "Đây là phương án tốt nhất tìm được trong thời gian cho phép; tính lại có thể cho kết quả khác.",
  },
  lines: {
    title: "Thùng hàng theo dòng đơn",
    sku: "SKU",
    rule: "Quy tắc",
    uom: "Đơn vị",
    cartons: "Số thùng",
    partial: "Thùng lẻ",
    dims: "Kích thước (cm)",
    weight: "Khối lượng (kg)",
    kitParts: (n: number) => `bộ ${n} kiện`,
    partialCell: (units: number, kg: string) => `${units} đơn vị · ${kg} kg`,
    none: "—",
    uomCell: (uom: string, factor: number) => `${uom} (×${factor})`,
  },
  unplaced: {
    title: "Kiện chưa xếp được",
    item: "Kiện",
    quantity: "Số kiện",
    reason: "Lý do",
    dims: "Kích thước (cm)",
  },
  warnings: {
    title: "Cảnh báo",
    kitWarningsTitle: "Cảnh báo về bộ",
  },
  incomplete: {
    title: "Ước tính chưa đủ: một số dòng thiếu kích thước hoặc khối lượng",
    description:
      "Các dòng dưới đây bị loại khỏi ước tính. Bổ sung trong hồ sơ hàng tồn rồi ước tính lại.",
    linkLabel: (sku: string) => `Mở hồ sơ hàng tồn ${sku}`,
    linkText: "Mở hồ sơ hàng tồn",
    noAccess: "Không có quyền mở hồ sơ hàng tồn",
    packagingMissingItems: "Mặt hàng cần bổ sung:",
    itemLinkLabel: (shortId: string) => `Mở hồ sơ hàng tồn ${shortId}`,
    missingFields: "Thiếu",
  },
} as const;

/** BE `EstimateLine.rule` — tầng quy tắc đóng gói đã dùng (LP2-2). */
export const LOAD_ESTIMATE_RULE_LABELS: Readonly<Record<string, string>> = {
  DEFAULT_SHIPPING_UNIT: "Đơn vị giao mặc định",
  LARGEST_PACKING_UNIT: "Đơn vị đóng gói lớn nhất",
  ITEM_BOX: "Hộp của mặt hàng",
  ITEM_UNIT: "Đơn vị của mặt hàng",
};

/** BE `UnplacedReason`. */
export const LOAD_ESTIMATE_UNPLACED_REASON_LABELS: Readonly<Record<string, string>> = {
  TOO_LARGE: "Quá lớn so với lòng xe hoặc cửa xe",
  TOO_HEAVY: "Quá nặng so với tải trọng xe",
  NO_VEHICLE_AVAILABLE: "Hết xe cùng loại để dùng",
  NO_SPACE: "Hết chỗ trong các xe",
  SEARCH_CUT_OFF: "Dừng do hết thời gian tính",
};

/** BE `LoadEstimates.MissingLine.missingFields` — trường kích thước / khối lượng của mặt hàng còn trống. */
export const LOAD_ESTIMATE_MISSING_FIELD_LABELS: Readonly<Record<string, string>> = {
  lengthCm: "chiều dài",
  widthCm: "chiều rộng",
  heightCm: "chiều cao",
  weightKg: "khối lượng",
};

/** BE `PackagingSpec.WarningCode` và `KitWarning.Type` (BE gửi câu tiếng Anh nên FE dịch theo mã). */
export const LOAD_ESTIMATE_WARNING_LABELS: Readonly<Record<string, string>> = {
  SHIPPING_UNIT_INCOMPLETE:
    "Đơn vị giao mặc định thiếu kích thước hoặc khối lượng — đã dùng tầng kế tiếp.",
  PACKING_UNIT_INCOMPLETE:
    "Một đơn vị đóng gói thiếu kích thước hoặc khối lượng — đã dùng đơn vị nhỏ hơn.",
  ITEM_BOX_INCOMPLETE: "Hộp của mặt hàng khai báo chưa đủ kích thước — không dùng hộp này.",
  UNIT_WEIGHT_UNKNOWN:
    "Mặt hàng chưa có khối lượng một đơn vị — thùng lẻ tính theo tỉ lệ khối lượng thùng.",
  CARTON_WEIGHT_BELOW_CONTENTS:
    "Khối lượng thùng nhẹ hơn hàng bên trong — thùng lẻ bị chặn ở khối lượng thùng.",
  PACKAGE_COUNT_IGNORED: "Dùng kích thước đơn vị dù hàng đi nhiều hộp — đã tính là một hộp.",
  FEWER_THAN_TWO_PARTS: "Bộ có ít hơn hai kiện — các kiện xếp rời.",
  NO_COMPLETE_SET: "Không đủ kiện cho một bộ trọn vẹn — các kiện xếp rời.",
  SURPLUS_PARTS: "Còn kiện thừa sau bộ cuối cùng — các kiện đó xếp rời.",
  PARTS_OF_DIFFERENT_SIZES:
    "Các kiện của bộ khác kích thước — bộ không được giữ nguyên, các kiện xếp rời.",
  FILL_IN_SET: "Kiện lấp chỗ trống không thuộc bộ nào.",
};

/** Mã lỗi BE của ước tính xếp xe (`ErrorCode.java`, BE PR #160) → câu tiếng Việt. */
export const LOAD_ESTIMATE_ERROR_MESSAGES = {
  LOAD_ESTIMATE_PACKAGING_MISSING:
    "Không dòng nào có đủ kích thước và khối lượng để ước tính. Bổ sung trong hồ sơ hàng tồn của từng mặt hàng rồi thử lại.",
  LOAD_ESTIMATE_TOO_MANY_CARTONS:
    "Đơn có quá nhiều thùng để ước tính một lần. Hãy chia đơn hoặc lập kế hoạch xếp xe thật.",
  LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE:
    "Đơn không ước tính được ở trạng thái hiện tại, hoặc không còn gì để giao. Hãy tải lại trang đơn.",
  LOAD_ESTIMATE_SOURCE_UNSUPPORTED: "Loại nguồn này chưa ước tính được.",
  LOAD_ESTIMATE_NOT_FOUND: "Chưa có ước tính cho đơn này.",
  VEHICLE_TYPE_INACTIVE: "Có loại xe đã ngừng dùng — bỏ chọn loại đó rồi thử lại.",
  VEHICLE_TYPE_NOT_FOUND: "Có loại xe không còn tồn tại — chọn lại loại xe.",
  NOT_FOUND: "Không tìm thấy đơn hoặc kho đã chọn.",
  OUT_OF_DATA_SCOPE: "Đơn thuộc kho ngoài phạm vi của bạn.",
  FORBIDDEN: "Bạn không có quyền ước tính xếp xe.",
  VALIDATION_FAILED: "Dữ liệu ước tính không hợp lệ. Kiểm tra kho, loại xe và cách chọn xe.",
  /** `VALIDATION_FAILED` rẽ theo `fieldErrors[].code` của BE: ô `warehouseId` / `vehicleTypeIds`. */
  WAREHOUSE_REQUIRED: "Chọn kho sẽ xuất hàng trước khi ước tính.",
  WAREHOUSE_MISMATCH: "Đơn đã release cho kho khác — không chọn kho khác được.",
  WAREHOUSE_INACTIVE: "Kho đã chọn không còn hoạt động.",
  NO_ACTIVE_VEHICLE_TYPE: "Chưa có loại xe nào đang dùng để ước tính.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
  generic: "Không ước tính được. Vui lòng thử lại.",
} as const;
