/**
 * Nhãn, thông báo và lỗi của màn Danh mục loại xe (docs 09 §3, BE PR #153 `VehicleTypeController`).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.vehicleType` / `TOAST_MESSAGES.vehicleType` trỏ về đây.
 */

import { VEHICLE_TYPE_LIMITS } from "./numbers";

import type { VEHICLE_TYPE_KINDS, VEHICLE_TYPE_STATUSES } from "./statuses";

type VehicleTypeKind = (typeof VEHICLE_TYPE_KINDS)[number];
type VehicleTypeStatus = (typeof VEHICLE_TYPE_STATUSES)[number];

/** BE `VehicleTypeRequest.kind`. */
export const VEHICLE_TYPE_KIND_LABELS: Record<VehicleTypeKind, string> = {
  CONTAINER: "Container",
  TRUCK: "Xe tải",
  PICKUP: "Xe bán tải",
};

/** BE `VehicleTypeResponse.status` — hiển thị đúng ngữ nghĩa ACTIVE / INACTIVE. */
export const VEHICLE_TYPE_STATUS_LABELS: Record<VehicleTypeStatus, string> = {
  ACTIVE: "Đang dùng",
  INACTIVE: "Ngừng dùng",
};

export const VEHICLE_TYPE_UI_LABELS = {
  pageTitle: "Loại xe",
  pageSubtitle:
    "Danh mục container, xe tải và xe bán tải dùng cho kế hoạch xếp xe. Không xoá được — ngừng dùng để ẩn khỏi kế hoạch mới.",
  navTooltip: "Vehicle types",
  create: "Thêm loại xe",
  edit: "Sửa",
  activate: "Dùng lại",
  deactivate: "Ngừng dùng",
  searchPlaceholder: "Tìm theo mã hoặc tên loại xe",
  statusFilter: "Trạng thái",
  all: "Tất cả",
  clearFilters: "Bỏ bộ lọc",
  listCaption: "loại xe",
  refetching: "Đang tải lại danh sách loại xe",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  rowActions: "Thao tác",
  presetBadge: "Mặc định",
  presetHint:
    "Loại xe mặc định của hệ thống: sửa được kích thước, tải trọng, số xe; không xoá và không đổi mã.",
  noPrice: "—",
  unitM: "m",
  unitM3: "m³",
  unitKg: "kg",
  unitMm: "mm",
  unitVnd: "VND",
  empty: {
    noDataTitle: "Chưa có loại xe",
    noDataDescription: "Thêm loại xe đầu tiên để dùng trong kế hoạch xếp xe.",
    noResultsDescription: "Không có loại xe nào khớp từ khoá hoặc bộ lọc hiện tại.",
  },
  forbiddenTitle: "Bạn không có quyền",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem danh mục loại xe.",
  noReadTitle: "Chưa được cấp quyền xem dữ liệu",
  noReadDescription:
    "Bạn được mở trang nhưng chưa được cấp quyền xem danh mục loại xe. Liên hệ quản trị để được cấp.",
  loadFailedTitle: "Không tải được danh mục loại xe",
  column: {
    code: "Mã",
    name: "Tên",
    kind: "Loại",
    innerSize: "Kích thước trong (D × R × C)",
    payload: "Tải trọng",
    availableCount: "Số xe",
    gusset: "Khe góc",
    status: "Trạng thái",
    actions: "Thao tác",
  },
  field: {
    code: "Mã loại xe",
    name: "Tên",
    kind: "Loại",
    innerLengthMm: "Dài trong (mm)",
    innerWidthMm: "Rộng trong (mm)",
    innerHeightMm: "Cao trong (mm)",
    gussetMm: "Khe góc trần (mm)",
    maxPayloadKg: "Tải trọng tối đa (kg)",
    availableCount: "Số xe sẵn có",
    rentalPrice: "Giá thuê tham khảo (VND)",
    status: "Trạng thái",
  },
  form: {
    createTitle: "Thêm loại xe",
    editTitle: "Sửa loại xe",
    createDescription:
      "Khai báo kích thước thùng bên trong (mm) và tải trọng. Mã viết hoa, chỉ gồm chữ, số, '-' và '_'; không đổi được sau khi tạo.",
    editDescription:
      "Mã không đổi được sau khi tạo. Ngừng dùng để loại xe không được chọn cho kế hoạch mới.",
    codeHint: `${VEHICLE_TYPE_LIMITS.codeMin}–${VEHICLE_TYPE_LIMITS.codeMax} ký tự; tự in hoa.`,
    gussetHint: `Chừa ở mỗi góc trên trần (0–${VEHICLE_TYPE_LIMITS.gussetMaxMm} mm); trống = 0.`,
    rentalHint: "Chỉ để tham khảo — kế hoạch không chọn xe theo giá.",
    volumeLabel: "Thể tích thùng",
    volumeEmpty: "Nhập đủ dài, rộng, cao để xem thể tích.",
    submitCreate: "Thêm loại xe",
    submitEdit: "Lưu",
    reloaded: "Dữ liệu vừa được người khác sửa — form đã nạp lại bản mới nhất.",
  },
  confirm: {
    deactivateTitle: "Ngừng dùng loại xe?",
    deactivateDescription:
      "Loại xe sẽ không được đưa vào kế hoạch xếp xe mới. Có thể dùng lại bất cứ lúc nào.",
    activateTitle: "Dùng lại loại xe?",
    activateDescription: "Loại xe sẽ được đưa vào kế hoạch xếp xe mới trở lại.",
  },
} as const;

/** Tên trường BE → nhãn tiếng Việt, để lỗi `VALIDATION_FAILED` chỉ đúng ô cần sửa. */
export const VEHICLE_TYPE_FIELD_LABELS: Record<string, string> = {
  code: VEHICLE_TYPE_UI_LABELS.field.code,
  name: VEHICLE_TYPE_UI_LABELS.field.name,
  kind: VEHICLE_TYPE_UI_LABELS.field.kind,
  innerLengthMm: VEHICLE_TYPE_UI_LABELS.field.innerLengthMm,
  innerWidthMm: VEHICLE_TYPE_UI_LABELS.field.innerWidthMm,
  innerHeightMm: VEHICLE_TYPE_UI_LABELS.field.innerHeightMm,
  gussetMm: VEHICLE_TYPE_UI_LABELS.field.gussetMm,
  maxPayloadKg: VEHICLE_TYPE_UI_LABELS.field.maxPayloadKg,
  availableCount: VEHICLE_TYPE_UI_LABELS.field.availableCount,
  rentalPrice: VEHICLE_TYPE_UI_LABELS.field.rentalPrice,
  status: VEHICLE_TYPE_UI_LABELS.field.status,
};

/** Lỗi form (client) — phản chiếu `VehicleTypeRequest` của BE. */
export const VEHICLE_TYPE_FIELD_MESSAGES = {
  codeRequired: "Nhập mã loại xe",
  codePattern: `Mã gồm ${VEHICLE_TYPE_LIMITS.codeMin}–${VEHICLE_TYPE_LIMITS.codeMax} ký tự: chữ, số, '-' hoặc '_', bắt đầu bằng chữ hoặc số`,
  nameRequired: "Nhập tên loại xe",
  nameTooLong: `Tên tối đa ${VEHICLE_TYPE_LIMITS.nameMax} ký tự`,
  numberRequired: "Nhập một số",
  integerRequired: "Nhập số nguyên",
  dimensionPositive: "Phải lớn hơn 0",
  dimensionTooLarge: `Tối đa ${VEHICLE_TYPE_LIMITS.dimensionMaxMm.toLocaleString("vi-VN")} mm`,
  gussetNegative: "Không được âm",
  gussetTooLarge: `Tối đa ${VEHICLE_TYPE_LIMITS.gussetMaxMm} mm`,
  payloadPositive: "Tải trọng phải lớn hơn 0",
  payloadTooLarge: `Tối đa ${VEHICLE_TYPE_LIMITS.payloadMaxKg.toLocaleString("vi-VN")} kg`,
  payloadFraction: `Tối đa ${VEHICLE_TYPE_LIMITS.payloadFractionDigits} số lẻ`,
  countNegative: "Không được âm",
  countTooLarge: `Tối đa ${VEHICLE_TYPE_LIMITS.availableCountMax.toLocaleString("vi-VN")} xe`,
  priceNegative: "Giá thuê không được âm",
  priceDigits: `Tối đa ${VEHICLE_TYPE_LIMITS.rentalPriceIntegerDigits} chữ số nguyên và ${VEHICLE_TYPE_LIMITS.rentalPriceFractionDigits} số lẻ`,
} as const;

/** `errorCode` của BE (PR #153 + mã chung) → câu tiếng Việt; không lộ message tiếng Anh. */
export const VEHICLE_TYPE_ERROR_MESSAGES = {
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
  VEHICLE_TYPE_NOT_FOUND: "Không tìm thấy loại xe — có thể đã bị xoá. Dữ liệu đã được tải lại.",
  VEHICLE_TYPE_CODE_EXISTS: "Mã loại xe này đã tồn tại. Hãy chọn mã khác.",
  OPTIMISTIC_LOCK: "Loại xe vừa được người khác sửa. Đã tải lại, hãy kiểm tra rồi thử lại.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  VALIDATION_CODE_IMMUTABLE: "Mã loại xe không đổi được sau khi tạo.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
} as const;

export const VEHICLE_TYPE_TOAST_MESSAGES = {
  created: "Đã thêm loại xe",
  updated: "Đã cập nhật loại xe",
  activated: "Đã dùng lại loại xe",
  deactivated: "Đã ngừng dùng loại xe",
} as const;
