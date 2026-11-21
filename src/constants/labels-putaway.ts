import { PUTAWAY_COLUMNS as C } from "./table";

import type { PUTAWAY_SOURCES, PUTAWAY_SUGGESTION_REASONS } from "./putaway";

type Source = (typeof PUTAWAY_SOURCES)[number];
type Reason = (typeof PUTAWAY_SUGGESTION_REASONS)[number];
type Column = (typeof C)[keyof typeof C];

/** Nhãn module Cất hàng (docs 05) — danh sách nhiệm vụ và màn cất một thùng. */
export const PUTAWAY_LABELS = {
  title: "Cất hàng",
  detailTitle: (lpn: string) => `Cất thùng ${lpn}`,
  searchPlaceholder: "Tìm LPN, SKU, lô, vị trí đang ở…",
  summarySearch: "Search chính",
  summaryColumnSearch: "Search trong cột",
  summaryColumns: "Cột hiển thị",
  warehouse: "Kho",
  warehousePlaceholder: "Chọn kho",
  warehouseTitle: "Kho cất hàng",
  receipt: "Phiếu nhập",
  receiptFilter: "Theo phiếu nhập",
  notChosen: "Chưa chọn",
  column: {
    [C.LPN]: "LPN",
    [C.SKU]: "SKU",
    [C.LOT]: "Lô",
    [C.QUANTITY]: "SL",
    [C.SOURCE_LOCATION]: "Đang ở",
    [C.SOURCE]: "Nguồn",
    [C.STATUS]: "Trạng thái",
    [C.ACTION]: "Thao tác",
  } satisfies Record<Column, string>,
  columnSearch: (label: string) => `Tìm trong cột ${label}`,
  source: {
    RECEIPT: "Phiếu nhập",
    QUARANTINE_RELEASE: "Giải phóng cách ly",
  } satisfies Record<Source, string>,
  putAway: (lpn: string) => `Cất thùng ${lpn}`,
  view: (lpn: string) => `Xem thùng ${lpn}`,
  // Lọc theo phiếu: BE trả mọi nhiệm vụ của phiếu, kể cả đã cất (docs 05 §4.2)
  truncated: (shown: number, total: number) =>
    `Đang hiện ${shown} / ${total} nhiệm vụ — lọc theo phiếu nhập để thu hẹp.`,
  empty: {
    chooseWarehouse: {
      title: "Chọn kho để xem việc cất hàng",
      description: "Việc cất hàng tính theo từng kho. Chọn kho ở ô Kho trên thanh công cụ.",
    },
    none: {
      title: "Không còn thùng chờ cất",
      description:
        "Thùng của phiếu nhập đã xác nhận và thùng được giải phóng khỏi khu cách ly sẽ hiện ở đây.",
    },
    noMatch: {
      title: "Không tìm thấy kết quả",
      description: "Không thùng nào khớp bộ lọc đang bật.",
      clear: "Bỏ bộ lọc",
    },
  },
  refetching: "Đang tải lại danh sách cất hàng",
  errorCopy: {
    pageTitle: "Cất hàng",
    notFoundTitle: "Không tìm thấy nhiệm vụ cất hàng",
    notFoundDescription: "Nhiệm vụ không tồn tại hoặc thuộc kho bạn không phụ trách.",
    forbiddenDescription: "Tài khoản chưa có quyền xem việc cất hàng của kho này.",
    noReadDescription:
      "Tài khoản chưa có quyền xem việc cất hàng. Liên hệ quản trị để được cấp quyền.",
  },
} as const;

/** Màn cất một thùng: thông tin, bin gợi ý, xác nhận (docs 05 §4.3–4.4). */
export const PUTAWAY_DETAIL_LABELS = {
  general: "Thông tin chung",
  lpn: "LPN",
  sku: "SKU",
  lot: "Lô",
  quantity: "Số lượng",
  units: (quantity: string) => `${quantity} cái`,
  sourceLocation: "Đang ở",
  source: "Nguồn",
  receipt: "Phiếu nhập",
  openReceipt: "Mở phiếu nhập",
  status: "Trạng thái",
  target: "Đã cất vào",
  suggestions: "Bin gợi ý",
  // Docs 05 §4.3 / 06 §4.4: quy tắc cố định, không cấu hình, không có điểm số
  suggestionsHint:
    "Xếp theo quy tắc cố định: cùng lô → bin trống → cùng SKU khác lô → SKU khác; trong mỗi nhóm ưu tiên bin vừa khít.",
  reason: {
    SAME_LOT: "Cùng lô",
    EMPTY: "Bin trống",
    SAME_SKU: "Cùng SKU, khác lô",
    OTHER_SKU: "SKU khác",
  } satisfies Record<Reason, string>,
  suggestionColumns: {
    caption: "Bin gợi ý theo thứ hạng",
    rank: "#",
    location: "Bin · lý do",
    capacity: "Chỗ trống",
    action: "Thao tác",
  },
  freeVolume: "Thể tích trống",
  freeWeight: "Tải còn",
  unlimited: "Không giới hạn",
  cubicMeters: (value: string) => `${value} m³`,
  kilograms: (value: string) => `${value} kg`,
  choose: "Chọn",
  chooseBin: (code: string) => `Chọn bin ${code}`,
  chosen: "Đang chọn",
  best: "Gợi ý số 1",
  noSuggestion: "Không bin nào nhận được thùng này",
  overflowHint: "Cất tạm vào khu OVERFLOW của kho (docs 05 BR-13):",
  noOverflow: "Kho chưa có khu OVERFLOW — báo Quản lý kho mở thêm bin hoặc khu tạm.",
  suggestionsDone: "Thùng đã được cất — không còn gợi ý.",
  confirmTitle: "Xác nhận cất hàng",
  lpnField: "Quét LPN",
  lpnPlaceholder: "Quét hoặc nhập LPN",
  lpnHint: "Quét mã trên nhãn thùng để xác nhận đúng thùng.",
  locationField: "Quét bin",
  locationPlaceholder: "Quét hoặc nhập mã bin",
  // BR-07 (docs 05 §6): cất vào bin khác gợi ý được, không cần lý do
  locationHint: "Cất vào bin khác gợi ý cũng được, miễn bin đó nhận được thùng.",
  submit: "Xác nhận cất hàng",
  doneTitle: "Đã cất xong",
  doneNote:
    "Nhiệm vụ đã xong không sửa được. Cất nhầm bin thì làm phiếu chuyển vị trí (docs 05 BR-06).",
  cancelledNote: "Nhiệm vụ đã huỷ — không còn thao tác.",
  readOnly: "Bạn chỉ có quyền xem nhiệm vụ cất hàng.",
  takeAlternative: (code: string) => `Dùng ${code}`,
  backToList: "Về danh sách cất hàng",
} as const;

export const PUTAWAY_FIELD_MESSAGES = {
  lpnRequired: "Quét LPN của thùng",
  lpnTooLong: "LPN tối đa 30 ký tự",
  locationRequired: "Quét mã bin",
  codeTooLong: "Mã vị trí tối đa 64 ký tự",
} as const;

/** Lỗi BE khi xác nhận cất (`PutawayService#putAway`, đúng thứ tự BE kiểm). */
export const PUTAWAY_ERROR_MESSAGES = {
  PUTAWAY_TASK_NOT_FOUND: "Nhiệm vụ cất hàng không còn tồn tại.",
  PUTAWAY_TASK_DONE: "Thùng này đã được cất rồi — danh sách đã được tải lại.",
  // BE 400 VALIDATION_FAILED không kèm field: task đã huỷ hoặc task lẻ cũ
  notActionable: "Nhiệm vụ không còn cất được (đã huỷ hoặc là nhiệm vụ lẻ cũ).",
  PUTAWAY_LPN_MISMATCH: (lpn: string) => `Sai thùng — quét đúng thùng ${lpn}.`,
  LOCATION_NOT_FOUND: "Không có vị trí này trong kho.",
  PUTAWAY_TARGET_NOT_BIN: "Đây là khu vực, không phải bin — chỉ khu OVERFLOW nhận thùng cất tạm.",
  MOVE_ACROSS_WAREHOUSES: "Bin thuộc kho khác — chỉ cất trong kho của thùng.",
  LOCATION_NOT_USABLE: "Bin đang khoá, bảo trì hoặc không cho phép cất hàng.",
  PUTAWAY_OVERFLOW_NOT_ALLOWED:
    "Còn bin nhận được thùng — chỉ cất vào OVERFLOW khi không bin nào vừa.",
  PUTAWAY_OVERFLOW_ALTERNATIVE: (code: string) => `Bin ${code} nhận được thùng này.`,
  CARTON_DOES_NOT_FIT_BIN: "Thùng không lọt bin này (kích thước).",
  LOCATION_CAPACITY_EXCEEDED: "Bin không còn đủ chỗ hoặc vượt tải — chọn bin khác.",
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho của nhiệm vụ này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  IDEMPOTENT_REQUEST_IN_PROGRESS: "Lần gửi trước đang xử lý — đợi vài giây rồi thử lại.",
  NETWORK_ERROR: "Mất kết nối — thùng chưa được cất, thử lại.",
  generic: "Không cất được thùng — thử lại.",
} as const;
