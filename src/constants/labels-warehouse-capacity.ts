/**
 * Nhãn, thông báo và lỗi của Bảng sức chứa kho (docs 06 §4.6, BR-20; BE `WarehouseCapacityController`).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.warehouseCapacity` / `TOAST_MESSAGES.warehouseCapacity` trỏ về đây.
 */

import { WAREHOUSE_CAPACITY_LIMITS as LIMITS } from "./numbers";

import type { CAPACITY_GROUP_KINDS } from "./statuses";

type CapacityGroupKind = (typeof CAPACITY_GROUP_KINDS)[number];

/** Tên cột theo docs 06 §4.6 bước 3 — giữ nguyên thuật ngữ nghiệp vụ. */
const METRIC = {
  capacity: "Sức chứa",
  occupied: "Đang chiếm",
  incoming: "Sắp về",
  projectedFree: "Còn trống dự kiến",
  pending: "Chờ duyệt",
  freeIfAllApproved: "Còn trống nếu duyệt hết",
  outgoing: "Sắp xuất",
  free: "Còn trống",
  occupiedKg: "Tải trọng đang chiếm",
  binVolume: "Thể tích bin",
} as const;

/** Tab xem theo cấp (docs 06 §4.6 bước 4) — zone gồm cả nhóm "Không thuộc zone". */
export const CAPACITY_GROUP_TABS = ["zones", "shelves", "areas"] as const;
export type CapacityGroupTab = (typeof CAPACITY_GROUP_TABS)[number];

export const CAPACITY_GROUP_KIND_LABELS: Record<CapacityGroupKind, string> = {
  ZONE: "Zone",
  NO_ZONE: "Không thuộc zone",
  SHELF: "Kệ",
  AREA: "Khu vực",
};

export const WAREHOUSE_CAPACITY_UI_LABELS = {
  pageTitle: "Sức chứa kho",
  detailTitle: "Sức chứa của kho",
  metric: METRIC,
  unitM3: "m³",
  unitKg: "kg",
  searchPlaceholder: "Tìm theo mã hoặc tên kho",
  summarySearch: "Search chính",
  listCaption: "kho",
  refetching: "Đang tải lại bảng sức chứa",
  refetchFailed: "Không tải lại được số liệu mới nhất — đang hiện bản đã tải trước đó.",
  unitNote: "Đơn vị: m³.",
  computedAtRead: "Số liệu tính tại lúc mở trang, không lưu.",
  column: {
    warehouse: "Kho",
    capacity: METRIC.capacity,
    occupied: METRIC.occupied,
    incoming: METRIC.incoming,
    projectedFree: METRIC.projectedFree,
    pending: METRIC.pending,
    freeIfAllApproved: METRIC.freeIfAllApproved,
    outgoing: `${METRIC.outgoing} (tham khảo)`,
    name: "Tên",
    free: METRIC.free,
    usage: "% đang chiếm",
    binsWithoutVolume: "Bin thiếu thể tích",
  },
  hint: {
    capacity: "Tổng thể tích bin đang dùng được × hệ số sử dụng",
    occupied: "Thùng ở bin và ở khu nhận hàng, khu tạm, khu cách ly",
    incoming: "Phần chưa nhận của Đơn sản xuất đã gửi về kho",
    projectedFree: "Sức chứa − Đang chiếm − Sắp về (có thể âm)",
    // Docs 06 §4.6 (chốt lại 2026-11-20): tên cột giữ nguyên, nay là Đơn sản xuất nháp chưa gửi
    pending: "Đơn sản xuất nháp, chưa gửi đi — không trừ vào còn trống dự kiến",
    freeIfAllApproved:
      "Còn trống dự kiến − Chờ duyệt, tức còn trống nếu gửi hết đơn nháp (có thể âm)",
    outgoing: "Thùng đã giữ cho đơn chưa giao — chỉ tham khảo, không cộng vào chỗ trống",
  },
  general: "Thông tin chung",
  warehouseCode: "Mã kho",
  warehouseName: "Tên kho",
  warehouseStatus: "Trạng thái",
  active: "Đang hoạt động",
  inactive: "Ngưng hoạt động",
  factor: "Hệ số sử dụng",
  factorHint: "Chỉ dùng cho bảng này — kiểm còn chỗ khi cất hàng vẫn dùng đủ thể tích bin.",
  editFactor: "Sửa hệ số",
  openMap: "Mở bản đồ kho",
  barLegend: "Phân bổ sức chứa",
  overCapacity: (m3: string) => `Vượt sức chứa ${m3} m³`,
  usageOf: (percent: string) => `${percent} sức chứa`,
  noCapacity: "Chưa có sức chứa",
  areaNoCapacity: "Khu vực không có sức chứa — chỉ tính đang chiếm.",
  groupsTitle: "Xem theo cấp",
  groupsAria: "Xem sức chứa theo zone, kệ hoặc khu",
  groupTab: { zones: "Zone", shelves: "Kệ", areas: "Khu vực" } satisfies Record<
    CapacityGroupTab,
    string
  >,
  groupsNote:
    "Sắp về, Chờ duyệt và Sắp xuất chỉ có ở cấp kho vì Đơn sản xuất và khoản giữ chỉ xác định tới kho.",
  groupEmpty: {
    zones: "Kho chưa có kệ nào để gom theo zone.",
    shelves: "Kho chưa có kệ nào.",
    areas: "Kho chưa có khu vực nào.",
  } satisfies Record<CapacityGroupTab, string>,
  warning: {
    negativeTitle: "Còn trống dự kiến đang âm",
    negative: (m3: string) =>
      `Hàng sắp về vượt chỗ trống ${m3} m³. Hàng về vẫn được nhận và cất vào khu tạm OVERFLOW.`,
    negativeIfApprovedTitle: "Không đủ chỗ nếu duyệt hết",
    negativeIfApproved: (m3: string) =>
      `Nếu gửi hết các Đơn sản xuất nháp về kho này, kho thiếu ${m3} m³.`,
    binsWithoutVolume: (n: number) =>
      `${n} bin chưa tính được thể tích (tầng thiếu chiều cao lọt) — chưa cộng vào Sức chứa. Bổ sung chiều cao lọt của tầng trên bản đồ kho.`,
    cartonsWithoutSize: (n: number) =>
      `${n} thùng đang ở kho có quy cách chưa khai báo kích thước — chưa cộng vào Đang chiếm.`,
    productionCartonsWithoutSize: (n: number) =>
      `${n} thùng của Đơn sản xuất có SKU chưa khai báo kích thước thùng — chưa cộng vào Sắp về / Chờ duyệt.`,
  },
  factorDialog: {
    title: "Sửa hệ số sử dụng",
    description:
      "Tỷ lệ thể tích bin thực sự xếp được (trừ lối thao tác, khe hở giữa các thùng). Bảng sức chứa tính lại ngay sau khi lưu.",
    field: "Hệ số sử dụng (%)",
    hint: `Lớn hơn 0 và tối đa ${LIMITS.factorPercentMax}%, mặc định ${LIMITS.factorPercentMax}%.`,
    submit: "Lưu hệ số",
    loading: "Đang tải thông tin kho…",
    loadFailed: "Không tải được thông tin kho để sửa. Vui lòng thử lại.",
  },
  validation: {
    factorRequired: "Nhập hệ số sử dụng.",
    factorRange: `Hệ số phải lớn hơn 0% và tối đa ${LIMITS.factorPercentMax}%.`,
    factorDecimals: `Tối đa ${LIMITS.factorPercentDecimals} chữ số thập phân.`,
  },
  empty: {
    noDataTitle: "Chưa có kho nào để xem sức chứa",
    noDataDescription: "Bảng chỉ hiện các kho đang hoạt động mà bạn được xem.",
    noResultsDescription: "Không có kho nào khớp từ khoá tìm kiếm.",
  },
  notFoundTitle: "Không tìm thấy kho",
  notFoundDescription: "Kho không tồn tại, đã ngưng hoạt động hoặc bạn không được xem kho này.",
  backToList: "Về bảng sức chứa",
  loadFailedTitle: "Không tải được bảng sức chứa",
  forbiddenDescription: "Bạn không có quyền xem bảng sức chứa của kho này.",
  noReadTitle: "Bạn không có quyền xem bảng sức chứa",
  noReadDescription: "Cần quyền xem Bảng sức chứa kho — liên hệ quản trị hệ thống.",
} as const;

export const WAREHOUSE_CAPACITY_TOAST_MESSAGES = {
  factorSaved: "Đã lưu hệ số sử dụng — bảng sức chứa đã tính lại.",
} as const;

/** Lỗi BE khi sửa hệ số (`PUT /warehouses/{id}`) → câu tiếng Việt; mã chung dùng `COMMON_API_ERROR_MESSAGES`. */
export const WAREHOUSE_CAPACITY_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho.",
  OUT_OF_DATA_SCOPE: "Kho này không thuộc phạm vi bạn được giao.",
  LAYOUT_OUT_OF_BOUNDS: "Khung bản đồ không còn chứa hết các vị trí — mở bản đồ kho để kiểm tra.",
  OPTIMISTIC_LOCK: "Kho vừa được người khác sửa. Thông tin đã tải lại, vui lòng lưu lại.",
};
