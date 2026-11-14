/**
 * Trạm kiểm thùng & dán nhãn giao hàng (docs 08, BE 4C-6) — nhãn, thông báo và lỗi tiếng Việt.
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Mã lỗi lấy nguyên văn từ BE `ErrorCode.java`; BE
 * chỉ trả message tiếng Anh không ổn định nên FE không hiển thị chuỗi đó.
 */

import { CARTON_CHECK_LIMITS } from "./numbers";

export const CARTON_CHECK_UI_LABELS = {
  /** Mục menu bên trái. */
  navTitle: "Kiểm thùng",
  queueTitle: "Hàng chờ kiểm thùng",
  queueSubtitle:
    "Đơn đã lấy hàng xong, thùng đã ở khu xuất hàng; cũ nhất trước. Mở một đơn để quét LPN, dán nhãn giao hàng và hoàn tất.",
  stationTitle: "Kiểm thùng & dán nhãn giao hàng",
  queueCaption: "đơn chờ kiểm thùng",
  refetching: "Đang tải lại hàng chờ kiểm thùng",
  openStation: "Mở trạm",
  emptyTitle: "Không có đơn nào chờ kiểm thùng",
  emptyDescription:
    "Chưa có đơn nào đã lấy hàng xong ở khu xuất hàng trong phạm vi kho bạn được xem, hoặc bộ lọc hiện tại không khớp. Đơn có thùng còn ở khu chờ xuất chỉ vào hàng chờ sau khi quản lý kho chuyển cả tác vụ sang khu xuất hàng.",
  clearFilters: "Bỏ bộ lọc",
  filters: {
    warehouse: "Kho",
    status: "Trạng thái",
    all: "Tất cả",
    allWaiting: "Đang chờ (mặc định)",
    warehouseLoadFailed: "Không tải được danh sách kho.",
  },
  statusFilter: {
    PENDING: "Chờ bắt đầu",
    IN_PROGRESS: "Đang kiểm thùng",
  },
  queueColumns: {
    order: "Đơn hàng",
    warehouse: "Kho",
    pickedAt: "Lấy xong",
    picker: "Người lấy",
    starter: "Người kiểm",
    status: "Trạng thái",
    cartons: "Thùng",
    shipments: "Shipment",
  },
  noStarter: "Chưa bắt đầu",
  cartonsCell: (checked: number, labeled: number, total: number) =>
    `${checked}/${total} đã quét · ${labeled} đã dán nhãn`,
  action: {
    start: "Bắt đầu kiểm thùng",
    complete: "Hoàn tất kiểm thùng",
    label: "Dán nhãn",
    labelAll: "Dán nhãn các thùng đã quét",
    print: "In nhãn",
    printAll: "In nhãn các thùng đã dán",
    reprint: "In lại nhãn",
    remove: "Loại thùng",
    dismiss: "Bỏ qua",
  },
  status: {
    starter: "Người bắt đầu",
    startedAt: "Bắt đầu lúc",
    completedAt: "Hoàn tất lúc",
    session: "Phiên kiểm",
    pick: "Lấy hàng",
    you: "Bạn",
    waiting: "Chưa bắt đầu",
    locked: "Đơn đã khoá",
    lockedYes: "Đã có thùng dán nhãn",
    lockedNo: "Chưa khoá",
  },
  notice: {
    waitingPick:
      "Chưa lấy hàng xong nên chưa kiểm thùng được. Thùng còn ở khu chờ xuất thì quản lý kho phải chuyển cả tác vụ sang khu xuất hàng trước.",
    viewOnly: "Bạn chỉ có quyền xem phiên kiểm thùng này.",
    readOnlyDone: "Đã kiểm đủ thùng và dán nhãn — phiên đã hoàn tất.",
    cancelled: "Đơn đã huỷ — phiên kiểm thùng đã đóng.",
    pendingStart:
      "Bấm Bắt đầu kiểm thùng để nhận đơn này; từ đó chỉ bạn hoặc quản lý kho thao tác tiếp.",
    takenTitle: (name: string) => `${name} đang kiểm thùng đơn này.`,
    takenAnonymous: "Một nhân viên khác đang kiểm thùng đơn này.",
    takenDescription:
      "Bạn chỉ xem được — chỉ người đã bắt đầu phiên hoặc quản lý kho mới thao tác.",
    managerTitle: (name: string) => `${name} đã bắt đầu phiên kiểm thùng này.`,
    managerDescription:
      "Bạn là quản lý kho nên vẫn thao tác được trong phiên này (người bắt đầu không đổi).",
    lockedTitle: "Đơn đã khoá",
    lockedDescription:
      "Đã có thùng được dán nhãn giao hàng: đơn không huỷ được và không đổi được địa chỉ giao (BR-04).",
    paymentTitle: "Đơn còn đợt thanh toán phải thu trước khi giao",
    paymentDescription: (amount: string) =>
      `Còn ${amount} phải thu trước khi bàn giao (đợt BEFORE_DELIVERY). Vẫn kiểm thùng và hoàn tất bình thường; bước bàn giao sẽ bị từ chối cho tới khi đợt này đã thu.`,
    unmeasuredTitle: "SKU chưa có quy cách thùng",
    unmeasuredDescription: (skus: string) =>
      `${skus} chưa khai báo kích thước hoặc khối lượng thùng nên thùng của SKU này chưa dán nhãn và chưa hoàn tất được. Quản lý kho bổ sung quy cách thùng ở màn sản phẩm rồi dán nhãn lại (BR-07).`,
    removedTitle: "Có thùng đã bị loại",
    removedDescription: (lpns: string) =>
      `${lpns} nằm trong hàng chờ cất lại để vào khu cách ly (QUARANTINE). Phần thiếu xử lý như thiếu hàng ở bước lấy hàng, hoặc giao một phần nếu đơn cho phép.`,
    refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  },
  lines: {
    title: "Dòng hàng của đơn",
    description:
      "Số cần giao của đợt này, số thùng của dòng và tiến độ quét kiểm, dán nhãn. Số cái trong thùng là số chuẩn của SKU — không mở thùng đếm.",
    sku: "SKU",
    wanted: "Cần",
    cartons: "Thùng",
    checked: "Đã quét",
    labeled: "Đã dán nhãn",
    removed: "Đã loại",
    shipped: "Đã vào shipment",
    labeledUnits: "SL đã dán nhãn",
    missing: "Còn thiếu",
    done: "Đủ",
  },
  scan: {
    title: "Quét LPN từng thùng",
    label: "Quét mã LPN trên thùng",
    placeholder: "Quét hoặc nhập LPN rồi nhấn Enter",
    hint: "Ô quét luôn sẵn sàng nhận mã — dùng máy quét hoặc gõ tay. Thùng phải là thùng đã lấy cho đúng đơn này; quét lại thùng đã kiểm không ghi thêm.",
    checked: (lpn: string) => `Đã kiểm thùng ${lpn}`,
    repeated: (lpn: string) => `Thùng ${lpn} đã kiểm trước đó — không ghi thêm`,
    failedTitle: "Lần quét chưa gửi được",
    failedHint: "Quét lại thùng này khi đã kết nối được máy chủ — quét lại không ghi trùng.",
  },
  cartons: {
    title: "Thùng của đơn",
    description:
      "Mỗi thùng là một kiện giao: To Check → Checked → Labeled. Kích thước và khối lượng lấy theo quy cách thùng của SKU, không nhập tay.",
    empty: "Phần lấy hàng của task chưa có thùng nào.",
    colNo: "#",
    colLpn: "LPN",
    colSku: "SKU",
    colLot: "Lô",
    colQty: "Số cái",
    colStatus: "Trạng thái",
    colLabel: "Nhãn",
    colSize: "Dài × rộng × cao",
    colWeight: "Khối lượng",
    colShipment: "Shipment",
    colActions: "Thao tác",
    labelVersion: (version: number) => `v${version}`,
    noLabel: "—",
    sizeCell: (length: string, width: string, height: string) =>
      `${length} × ${width} × ${height} cm`,
    weightCell: (weight: string, dim: string) => `${weight} kg · quy đổi ${dim} kg`,
    notRotatable: "Không xoay",
    removedDamaged: "Hư hỏng",
    removedOrderCancelled: "Đơn huỷ",
    removalNote: (note: string) => `Ghi chú: ${note}`,
    notReceived: "Chưa quét",
  },
  remove: {
    title: (lpn: string) => `Loại thùng ${lpn}`,
    description:
      "Thùng hư hỏng bên ngoài (móp, rách, ướt) bị loại khỏi đơn; thùng vào hàng chờ cất lại và được cất nguyên thùng vào khu cách ly (QUARANTINE). Phần thiếu xử lý như thiếu hàng. Nhãn giao (nếu có) bị huỷ.",
    note: "Ghi chú tình trạng thùng",
    notePlaceholder: "Vd: móp góc, rách băng keo, thấm nước",
    noteHint: "Không bắt buộc; người cất thùng vào khu cách ly sẽ đọc ghi chú này.",
    submit: "Loại thùng",
  },
  reprint: {
    title: (lpn: string) => `In lại nhãn thùng ${lpn}`,
    description: (version: number) =>
      `Nhãn đang dán (v${version}) sẽ vô hiệu; hệ thống tạo nhãn phiên bản ${version + 1} theo quy cách thùng hiện tại. Nhãn LPN giữ nguyên.`,
    submit: "In lại nhãn",
  },
  labels: {
    title: "Nhãn giao hàng",
    descriptionAll:
      "Nhãn giao hàng của mọi thùng đã dán nhãn chưa vào shipment — một trang 100 × 150 mm mỗi thùng.",
    descriptionLpns: (lpns: string) =>
      `Nhãn giao hàng của thùng ${lpns} — một trang 100 × 150 mm mỗi thùng.`,
    preview: "Xem trước nhãn giao hàng",
    generate: "Tạo file nhãn",
    regenerate: "Tạo lại",
    generating: "Đang tạo nhãn…",
    printNow: "In nhãn",
    download: "Tải xuống",
    close: "Đóng",
    stickHint: "In xong, dán nhãn lên thùng cạnh nhãn LPN.",
  },
  complete: {
    title: "Hoàn tất kiểm thùng",
    description:
      "Các thùng đã dán nhãn chưa vào shipment sẽ gom thành một shipment Ready to Dispatch (mã <mã đơn>-S<n>) để bàn giao.",
    modeFull: "Đủ thùng cả đơn",
    modeFullHint: "Mọi thùng đã Labeled hoặc Removed và đủ số cái của đợt giao.",
    modePartial: "Giao một phần",
    modePartialHint:
      "Giao trước các thùng đã dán nhãn; phần còn lại kiểm tiếp khi thùng được lấy bổ sung. Cần Sale cho phép giao một phần.",
    fullBlocked: (count: number) => `Còn ${count} dòng chưa đủ thùng — chỉ giao được một phần.`,
    partialUnavailable: "Đủ thùng rồi nên không cần giao một phần.",
    note: "Lý do giao một phần",
    notePlaceholder: "Vd: thùng hư hỏng đã loại, khách đồng ý nhận trước",
    pendingTitle: "Còn thùng chưa dán nhãn",
    pendingDescription: (lpns: string) =>
      `Dán nhãn hoặc loại ${lpns} trước khi hoàn tất — mọi thùng phải Labeled hoặc Removed.`,
    nothingTitle: "Chưa có thùng nào đã dán nhãn",
    nothingDescription: "Dán nhãn ít nhất một thùng (hoặc kiểm đủ rồi dán nhãn) để có gì mà giao.",
    missingTitle: "Dòng còn thiếu",
    missingLine: (sku: string, labeled: number, wanted: number) =>
      `${sku}: ${labeled}/${wanted} cái đã dán nhãn`,
    submitFull: "Hoàn tất kiểm thùng",
    submitPartial: "Giao một phần",
    resultTitle: "Đã tạo shipment",
    resultCartons: (count: number) => `${count} thùng`,
    resultFull: "Đã kiểm đủ thùng — đơn đã Packed.",
    resultPartial:
      "Đã giao một phần — phiên vẫn In Progress; phần còn lại kiểm tiếp khi thùng được lấy bổ sung.",
    resultLoading: "Đang tải shipment vừa tạo…",
    close: "Đóng",
  },
  shipments: {
    title: "Shipment đã tạo",
    description:
      "Mỗi lần hoàn tất tạo một shipment; lập kế hoạch xe và bàn giao ở màn Xếp xe & bàn giao.",
    code: "Mã shipment",
    status: "Trạng thái",
    cartons: "Số thùng",
    readyAt: "Sẵn sàng lúc",
    partial: "Giao một phần",
  },
  field: {
    unknown: "—",
  },
} as const;

export const CARTON_CHECK_TOAST_MESSAGES = {
  started: "Đã bắt đầu kiểm thùng đơn này",
  labeled: "Đã dán nhãn các thùng",
  reprinted: "Đã in lại nhãn — nhãn cũ vô hiệu",
  removed: "Đã loại thùng — thùng chờ cất vào khu cách ly",
  shipped: "Đã tạo shipment",
  shippedPartial: "Đã giao một phần — phần còn lại kiểm tiếp khi thùng được lấy bổ sung",
  packed: "Đã kiểm đủ thùng — đơn đã Packed",
} as const;

/** Lỗi nhập ở form quét / loại thùng / hoàn tất — hiện inline dưới ô. */
export const CARTON_CHECK_FIELD_MESSAGES = {
  lpnRequired: "Nhập hoặc quét mã LPN",
  lpnTooLong: `LPN tối đa ${CARTON_CHECK_LIMITS.lpnMax} ký tự`,
  noteRequired: "Ghi lý do giao một phần",
  noteTooLong: `Tối đa ${CARTON_CHECK_LIMITS.noteMax} ký tự`,
} as const;

/**
 * BE `errorCode` (4C-6) → câu tiếng Việt. `VALIDATION_FAILED` và các mã có ngữ cảnh riêng (`CARTON_NOT_CHECKED`,
 * `CARTON_SPEC_UNMEASURED`) xử lý ở `carton-check-errors.ts`.
 */
export const CARTON_CHECK_ERROR_MESSAGES = {
  // 404: task không có (kho ngoài phạm vi trả 403 OUT_OF_DATA_SCOPE, không phải 404)
  NOT_FOUND: "Không tìm thấy task kiểm thùng. Dữ liệu đã được tải lại.",
  PACKING_NOT_READY:
    "Chưa lấy hàng xong — kiểm thùng chỉ bắt đầu khi mọi thùng đã ở khu xuất hàng. Thùng ở khu chờ xuất thì quản lý kho phải chuyển cả tác vụ sang khu xuất hàng.",
  PACKING_TAKEN:
    "Phiên kiểm thùng này do nhân viên khác bắt đầu — chỉ người bắt đầu hoặc quản lý kho thao tác tiếp.",
  PACK_STATE_CONFLICT:
    "Trạng thái phiên kiểm thùng hoặc của đơn đã đổi (đơn đang treo, đã huỷ, hoặc thùng đã bị loại) nên không thực hiện được. Dữ liệu đã được tải lại.",
  CARTON_NOT_IN_TASK:
    "Thùng này không thuộc phần lấy hàng của đơn, hoặc LPN không đọc đúng. Không ghi gì — báo quản lý kho kiểm lại phần lấy hàng và tồn kho.",
  PACKAGE_SHIPPED: "Thùng đã nằm trong shipment nên không loại khỏi đơn được.",
  PACKING_INCOMPLETE:
    "Chưa kiểm đủ thùng: còn thùng chưa dán nhãn, hoặc thiếu thùng so với đơn. Dán nhãn hoặc loại hết thùng còn lại, hoặc chọn giao một phần và ghi lý do.",
  // Đơn chưa được Sale cho phép giao một phần: kho không tự quyết
  PACK_PARTIAL_NOT_ALLOWED:
    "Đơn chưa được phép giao một phần — dán nhãn đủ mọi thùng, hoặc nhờ Sale bật cho phép giao một phần trên đơn.",
  PACK_NOTHING_TO_SHIP: "Chưa có thùng nào đã dán nhãn đang chờ vào shipment.",
  OUT_OF_DATA_SCOPE: "Đơn này thuộc kho ngoài phạm vi bạn được thao tác.",
  ORDER_CANCELLED: "Đơn hàng đã huỷ nên phiên kiểm thùng đã đóng.",
} as const;

/** `CARTON_NOT_CHECKED` đổi nghĩa theo thao tác: dán nhãn cần thùng đã quét; in / in lại cần thùng đã dán nhãn. */
export const CARTON_NOT_CHECKED_MESSAGES = {
  label: "Thùng chưa được quét kiểm — quét LPN của thùng trước khi dán nhãn.",
  print: "Chỉ thùng đã dán nhãn mới có nhãn giao hàng để in.",
  reprint: "Chỉ thùng đã dán nhãn mới in lại nhãn được.",
  generic: "Thao tác này chỉ áp dụng cho thùng đã quét kiểm hoặc đã dán nhãn.",
} as const;

/** `CARTON_SPEC_UNMEASURED` (BR-07). `{skus}` = các SKU BE nêu trong `fieldErrors`. */
export const CARTON_SPEC_UNMEASURED_MESSAGES = {
  withSkus: (skus: string) =>
    `${skus} chưa khai báo kích thước hoặc khối lượng thùng nên chưa dán nhãn được. Quản lý kho bổ sung quy cách thùng của SKU rồi dán nhãn lại.`,
  generic:
    "SKU của thùng chưa khai báo kích thước hoặc khối lượng thùng nên chưa dán nhãn được. Quản lý kho bổ sung quy cách thùng của SKU rồi dán nhãn lại.",
} as const;

/**
 * Phản hồi của BE sai hợp đồng (zod parse lỗi): BE có thể ĐÃ ghi thao tác, nên phiên được tải lại để xem kết quả thật.
 */
export const CARTON_CHECK_INVALID_RESPONSE_MESSAGE =
  "Máy chủ trả dữ liệu sai định dạng — thao tác có thể đã được ghi. Phiên đã được tải lại, kiểm tra trước khi thao tác tiếp.";

/** Mã lỗi nghiệp vụ kiểm thùng — dữ liệu phiên đã đổi ở nơi khác thì tải lại (xem `carton-check-errors.ts`). */
export const CARTON_CHECK_STALE_ERROR_CODES = [
  "PACKING_NOT_READY",
  "PACKING_TAKEN",
  "PACK_STATE_CONFLICT",
  "CARTON_NOT_CHECKED",
  "PACKAGE_SHIPPED",
  "PACKING_INCOMPLETE",
  "PACK_NOTHING_TO_SHIP",
  "ORDER_CANCELLED",
] as const;

/** Tên field BE (`FieldError.field`) của `VALIDATION_FAILED` → câu tiếng Việt. */
export const CARTON_CHECK_VALIDATION_FIELD_MESSAGES = {
  lpn: CARTON_CHECK_FIELD_MESSAGES.lpnRequired,
  lpns: `Chọn tối đa ${CARTON_CHECK_LIMITS.selectionMax} thùng mỗi lần.`,
  note: CARTON_CHECK_FIELD_MESSAGES.noteRequired,
} as const;
