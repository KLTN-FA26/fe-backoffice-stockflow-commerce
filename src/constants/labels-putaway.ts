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
  summarySearch: "Tìm kiếm chính",
  summaryColumns: "Cột hiển thị",
  receipt: "Phiếu nhập",
  receiptFilter: "Theo phiếu nhập",
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
  source: {
    RECEIPT: "Phiếu nhập",
    QUARANTINE_RELEASE: "Giải phóng cách ly",
  } satisfies Record<Source, string>,
  putAway: (lpn: string) => `Cất thùng ${lpn}`,
  putAwayShort: "Cất",
  viewShort: "Xem",
  // Ô quét LPN ngay trên danh sách: quét là mở đúng thùng đó
  scanLabel: "Quét LPN để mở thùng",
  scanPlaceholder: "Quét hoặc nhập LPN của thùng",
  scanHint: "Quét mã trên nhãn thùng — mở thẳng màn cất thùng đó.",
  scanOpened: (lpn: string) => `Mở thùng ${lpn}`,
  scanNotFound: (lpn: string) => `Không có thùng ${lpn} trong danh sách đang xem.`,
  view: (lpn: string) => `Xem thùng ${lpn}`,
  // Lọc theo phiếu: BE trả mọi nhiệm vụ của phiếu, kể cả đã cất (docs 05 §4.2)
  truncated: (shown: number, total: number) =>
    `Đang hiện ${shown} / ${total} nhiệm vụ — lọc theo phiếu nhập để thu hẹp.`,
  empty: {
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
  suggestions: "Ô kệ gợi ý",
  // Docs 05 §4.3 / 06 §4.4: quy tắc cố định, không cấu hình, không có điểm số
  suggestionsHint:
    "Xếp theo quy tắc cố định: cùng lô → ô kệ trống → cùng SKU khác lô → SKU khác; trong mỗi nhóm ưu tiên ô kệ vừa khít.",
  reason: {
    SAME_LOT: "Cùng lô",
    EMPTY: "Ô kệ trống",
    SAME_SKU: "Cùng SKU, khác lô",
    OTHER_SKU: "SKU khác",
  } satisfies Record<Reason, string>,
  suggestionColumns: {
    caption: "Ô kệ gợi ý theo thứ hạng",
    rank: "#",
    location: "Ô kệ · lý do",
    capacity: "Chỗ trống",
    action: "Thao tác",
  },
  freeVolume: "Thể tích trống",
  freeWeight: "Tải còn",
  unlimited: "Không giới hạn",
  cubicMeters: (value: string) => `${value} m³`,
  kilograms: (value: string) => `${value} kg`,
  choose: "Chọn",
  chooseBin: (code: string) => `Chọn ô kệ ${code}`,
  chosen: "Đang chọn",
  best: "Gợi ý số 1",
  noSuggestion: "Không ô kệ nào nhận được thùng này",
  overflowHint: "Cất tạm vào khu OVERFLOW của kho:",
  noOverflow: "Kho chưa có khu OVERFLOW — báo Quản lý kho mở thêm ô kệ hoặc khu tạm.",
  suggestionsDone: "Thùng đã được cất — không còn gợi ý.",
  confirmTitle: "Xác nhận cất hàng",
  lpnField: "Quét LPN",
  lpnPlaceholder: "Quét hoặc nhập LPN",
  lpnHint: "Quét mã trên nhãn thùng để xác nhận đúng thùng.",
  locationField: "Quét ô kệ",
  locationPlaceholder: "Quét hoặc nhập mã ô kệ",
  // BR-07 (docs 05 §6): cất vào bin khác gợi ý được, không cần lý do
  locationHint: "Cất vào ô kệ khác gợi ý cũng được, miễn ô kệ đó nhận được thùng.",
  submit: "Xác nhận cất hàng",
  doneTitle: "Đã cất xong",
  doneNote: "Nhiệm vụ đã xong không sửa được. Cất nhầm ô kệ thì làm phiếu chuyển vị trí.",
  cancelledNote: "Nhiệm vụ đã huỷ — không còn thao tác.",
  readOnly: "Bạn chỉ có quyền xem nhiệm vụ cất hàng.",
  takeAlternative: (code: string) => `Dùng ${code}`,
  takeLast: (code: string) => `Dùng ${code} (vừa cất)`,
  seeMore: (count: number) => `Xem thêm ${count} ô kệ`,
  seeLess: "Thu gọn",
  nextCarton: (remaining: number) => `Cất thùng tiếp theo (còn ${remaining})`,
  nextCartonLast: "Không còn thùng chờ cất",
  tripHint: "Cất nhiều thùng một lượt thì mở Chuyến cất hàng.",
  openTrip: "Mở Chuyến cất hàng",
  backToList: "Về danh sách cất hàng",
} as const;

export const PUTAWAY_FIELD_MESSAGES = {
  lpnRequired: "Quét LPN của thùng",
  lpnTooLong: "LPN tối đa 30 ký tự",
  locationRequired: "Quét mã ô kệ",
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
  PUTAWAY_TARGET_NOT_BIN: "Đây là khu vực, không phải ô kệ — chỉ khu OVERFLOW nhận thùng cất tạm.",
  MOVE_ACROSS_WAREHOUSES: "Ô kệ thuộc kho khác — chỉ cất trong kho của thùng.",
  LOCATION_NOT_USABLE: "Ô kệ đang khoá, bảo trì hoặc không cho phép cất hàng.",
  PUTAWAY_OVERFLOW_NOT_ALLOWED:
    "Còn ô kệ nhận được thùng — chỉ cất vào OVERFLOW khi không ô kệ nào vừa.",
  PUTAWAY_OVERFLOW_ALTERNATIVE: (code: string) => `Ô kệ ${code} nhận được thùng này.`,
  CARTON_DOES_NOT_FIT_BIN: "Thùng không lọt ô kệ này (kích thước).",
  LOCATION_CAPACITY_EXCEEDED: "Ô kệ không còn đủ chỗ hoặc vượt tải — chọn ô kệ khác.",
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho của nhiệm vụ này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  IDEMPOTENT_REQUEST_IN_PROGRESS: "Lần gửi trước đang xử lý — đợi vài giây rồi thử lại.",
  NETWORK_ERROR: "Mất kết nối — thùng chưa được cất, thử lại.",
  generic: "Không cất được thùng — thử lại.",
} as const;

/** Trang "Gợi ý vị trí" của một kho (docs 06 §4.4): slotting = bộ lọc + xếp hạng cố định của cất hàng. */
export const SLOTTING_LABELS = {
  title: "Gợi ý vị trí",
  cartons: "Thùng chờ cất",
  cartonCount: (count: number) => `${count} thùng`,
  search: "Lọc LPN, SKU, lô…",
  suggestionsFor: (lpn: string) => `Ô kệ gợi ý cho ${lpn}`,
  putAway: "Cất thùng này",
  noCartons: {
    title: "Kho không còn thùng chờ cất",
    description:
      "Gợi ý vị trí tính cho thùng đang chờ cất. Khi có phiếu nhập được xác nhận, thùng sẽ hiện ở đây.",
  },
  noMatch: "Không thùng nào khớp ô lọc.",
  pickCarton: "Chọn một thùng ở danh sách bên trái để xem ô kệ gợi ý.",
  warehouseUnknown: "Không tìm thấy kho trong danh mục kho bạn được xem.",
  rules: {
    title: "Quy tắc xếp hạng",
    // Docs 06 §1: bảng slotting_rule có trong CSDL nhưng chưa có chức năng — quy tắc cố định
    fixed: "Quy tắc cố định của hệ thống — chưa cấu hình được.",
    filterTitle: "Ô kệ được xét",
    filters: [
      "Ô kệ (không phải khu) cùng kho, bật “Cho phép cất hàng”, kho / kệ / ô kệ đang hoạt động.",
      "Thùng lọt ô kệ theo từng chiều; còn đủ thể tích (đã trừ chỗ chuyến khác giữ) và trong giới hạn tải.",
    ],
    orderTitle: "Thứ tự ưu tiên",
    order: [
      "Cùng lô — ô kệ đã chứa đúng lô này.",
      "Ô kệ trống.",
      "Cùng SKU, khác lô.",
      "SKU khác.",
    ],
    tieTitle: "Trong cùng nhóm",
    ties: [
      "Ưu tiên ô kệ vừa khít (còn ít chỗ nhất). Ô kệ trống: ô kệ nhỏ nhất chứa được phần còn lại của lô.",
      "Hoà thì theo mã vị trí; ô kệ chưa có thể tích xếp cuối. Tối đa 10 ô kệ.",
    ],
    overflow:
      "Không ô kệ nào nhận → khu OVERFLOW của kho. Cất vào ô kệ khác gợi ý không cần lý do.",
  },
} as const;

/** Chuyến cất hàng (docs 05 §4.5): gom nhiều thùng lên xe, đi theo lộ trình, đặt từng thùng vào bin. */
export const PUTAWAY_TRIP_LABELS = {
  title: "Chuyến cất hàng",
  // Mỗi NV chỉ một chuyến mở trên mọi kho (PUTAWAY_TRIP_ALREADY_OPEN) — chuyến ở kho khác thì không hiện trong tab này
  elsewhere: {
    mine: (prefix: string) => `Bạn đang có chuyến mở ở kho ${prefix}`,
    other: (prefix: string) => `Chuyến này thuộc kho ${prefix}`,
    // Danh mục kho không có kho của chuyến → không dựng được link, dẫn về bước chọn kho
    mineUnknown: "Bạn đang có chuyến mở ở một kho khác",
    otherUnknown: "Chuyến này thuộc một kho khác",
    description: "Chuyến cất hàng làm việc theo một kho. Mở chuyến ở kho của nó để tiếp tục.",
    open: "Mở chuyến ở kho đó",
  },
  myTrip: "Chuyến của tôi",
  openAction: "Chuyến cất hàng",
  general: "Thông tin chuyến",
  status: "Trạng thái",
  cartonCount: "Số thùng",
  progress: "Đã cất",
  progressValue: (placed: number, total: number) => `${placed}/${total}`,
  startedAt: "Bắt đầu đi",
  lastActivity: "Hoạt động gần nhất",
  startFrom: "Xuất phát",
  notStarted: "Chưa đi",
  start: {
    title: "Mở chuyến cất hàng",
    description:
      "Gom nhiều thùng chờ cất lên một xe, hệ thống gán ô kệ cho từng thùng và xếp lộ trình khi bắt đầu đi.",
    submit: "Mở chuyến",
    noPermission: "Bạn chỉ có quyền xem chuyến cất hàng.",
  },
  load: {
    title: "Xếp thùng lên xe",
    field: "Quét LPN",
    placeholder: "Quét hoặc nhập LPN",
    hint: "Enter để xếp thùng lên xe. Chỉ thùng chờ cất cùng kho; quét lại thùng đã có trên xe không đổi gì.",
    depart: "Bắt đầu đi cất",
    departHint: "Hệ thống gán ô kệ cho từng thùng, giữ chỗ và xếp lộ trình.",
    emptyCart: "Xếp ít nhất một thùng trước khi đi.",
  },
  cart: {
    title: "Thùng trên xe",
    empty: "Xe chưa có thùng nào — quét LPN để xếp lên.",
    lpn: "LPN",
    item: "SKU · lô",
    bin: "Ô kệ gán",
    status: "Trạng thái",
    unload: (lpn: string) => `Bỏ thùng ${lpn} khỏi xe`,
    holding: "Đang giữ chỗ",
    holdExpired: "Hết giữ chỗ — quét lại ô kệ hoặc đổi ô kệ",
  },
  route: {
    title: "Lộ trình",
    note: "Lộ trình chỉ để tham khảo — đi thứ tự khác vẫn được.",
    stop: (sequence: number) => `Điểm ${sequence}`,
    reassign: (lpn: string) => `Đổi ô kệ cho ${lpn}`,
    reassignShort: "Đổi ô kệ",
    noBin: "Chưa có ô kệ",
  },
  place: {
    title: "Đặt thùng vào ô kệ",
    bin: "Quét ô kệ",
    binPlaceholder: "Quét hoặc nhập mã ô kệ",
    binHint: "Quét ô kệ đang đứng trước — ô kệ khác ô kệ gán cũng được nếu nhận được thùng.",
    lpn: "Quét LPN",
    lpnPlaceholder: "Quét hoặc nhập LPN",
    lpnHint: "Quét thùng đặt vào ô kệ vừa quét.",
    submit: "Xác nhận đặt thùng",
    placed: (lpn: string, bin: string) => `Đã đặt thùng ${lpn} vào ${bin}`,
  },
  close: {
    action: "Đóng chuyến",
    loadingAction: "Huỷ chuyến",
    force: "Đóng chuyến hộ",
    title: "Đóng chuyến cất hàng?",
    description: (onCart: number) =>
      onCart > 0
        ? `${onCart} thùng còn trên xe sẽ trả về hàng chờ cất, chỗ giữ ở ô kệ được nhả. Không hoàn tác được.`
        : "Chuyến sẽ đóng. Không hoàn tác được.",
    forceDescription: (onCart: number) =>
      `Đóng chuyến bỏ dở của nhân viên khác. ${onCart} thùng còn trên xe trả về hàng chờ cất.`,
  },
  ended: {
    COMPLETED: "Chuyến đã cất hết thùng.",
    CLOSED: "Chuyến đã đóng — thùng chưa cất đã trả về hàng chờ.",
    newTrip: "Mở chuyến mới",
    backToList: "Về danh sách cất hàng",
  },
  notMine: "Chuyến của nhân viên khác — chỉ xem.",
  readOnly: "Bạn chỉ có quyền xem chuyến cất hàng.",
  refetching: "Đang tải lại chuyến",
  errorCopy: {
    pageTitle: "Chuyến cất hàng",
    notFoundTitle: "Không tìm thấy chuyến cất hàng",
    notFoundDescription: "Chuyến không tồn tại hoặc thuộc kho bạn không phụ trách.",
    forbiddenDescription: "Tài khoản chưa có quyền xem chuyến cất hàng.",
    noReadDescription:
      "Tài khoản chưa có quyền xem chuyến cất hàng. Liên hệ quản trị để được cấp quyền.",
  },
} as const;

/** Lỗi BE của chuyến cất hàng (`PutawayTripService`); lỗi đặt thùng dùng chung `PUTAWAY_ERROR_MESSAGES`. */
export const PUTAWAY_TRIP_ERROR_MESSAGES = {
  PUTAWAY_TRIP_ALREADY_OPEN: "Bạn đang có một chuyến mở — mỗi người chỉ một chuyến.",
  PUTAWAY_TRIP_NOT_FOUND: "Chuyến cất hàng không còn tồn tại.",
  PUTAWAY_TRIP_NOT_YOURS: "Đây không phải chuyến của bạn.",
  PUTAWAY_TRIP_INVALID_STATE: "Chuyến đã đổi trạng thái — đã tải lại.",
  PUTAWAY_TRIP_EMPTY: "Xe chưa có thùng nào.",
  PUTAWAY_TASK_ON_ANOTHER_TRIP: "Thùng đang ở trên xe của chuyến khác.",
  PUTAWAY_CARTON_NOT_ON_TRIP: "Thùng không có trên xe của chuyến này.",
  STOCK_PACKAGE_NOT_FOUND: "Không có thùng mang LPN này.",
  PUTAWAY_TASK_NOT_FOUND: "Thùng không chờ cất (đã cất hoặc chưa ghi nhận).",
  MOVE_ACROSS_WAREHOUSES: "Thùng thuộc kho khác kho của chuyến.",
  LOCATION_NOT_FOUND: "Thùng chưa có vị trí trong kho.",
} as const;
