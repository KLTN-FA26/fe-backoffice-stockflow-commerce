/**
 * Trạm đóng gói (docs 08, BE PR #136 SCRUM-278/281/282) — nhãn, thông báo và lỗi tiếng Việt.
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Mã lỗi lấy nguyên văn từ BE
 * `ErrorCode.java`; BE chỉ trả message tiếng Anh không ổn định nên FE không hiển thị chuỗi đó.
 */

import { PACKING_LIMITS } from "./numbers";

export const PACKING_UI_LABELS = {
  queueTitle: "Hàng chờ đóng gói",
  queueSubtitle:
    "Đơn đã lấy hàng xong, xếp theo thời điểm lấy xong (cũ nhất trước). Mở một đơn để quét kiểm, đóng kiện và hoàn tất.",
  stationTitle: "Trạm đóng gói",
  queueCaption: "đơn chờ đóng gói",
  refetching: "Đang tải lại hàng chờ đóng gói",
  openStation: "Mở trạm",
  emptyTitle: "Không có đơn nào chờ đóng gói",
  emptyDescription:
    "Chưa có đơn nào lấy hàng xong trong phạm vi kho bạn được xem, hoặc bộ lọc hiện tại không khớp.",
  clearFilters: "Bỏ bộ lọc",
  filters: {
    warehouse: "Kho",
    status: "Trạng thái",
    all: "Tất cả",
    allWaiting: "Đang chờ (mặc định)",
    warehouseLoadFailed: "Không tải được danh sách kho.",
  },
  statusFilter: {
    PENDING: "Chờ nhận đóng gói",
    PACKING: "Đang đóng gói",
    ON_HOLD: "Đang giữ (lệch thiết kế)",
  },
  queueColumns: {
    order: "Đơn hàng",
    warehouse: "Kho",
    pickedAt: "Lấy xong",
    picker: "Người lấy",
    packer: "Người đóng",
    status: "Trạng thái",
    packages: "Kiện",
    shipments: "Lô giao",
  },
  noPacker: "Chưa có ai nhận",
  packagesCell: (sealed: number, total: number) => `${sealed}/${total} đã niêm phong`,
  action: {
    start: "Bắt đầu đóng gói",
    complete: "Hoàn tất đóng gói",
    openPackage: "Mở kiện mới",
    seal: "Cân, đo & niêm phong",
    reopen: "Mở lại kiện",
    voidPackage: "Huỷ kiện",
    removeUnits: "Bớt hàng",
    label: "Xem nhãn",
    print: "In nhãn",
    reverify: "Kiểm tra lại thiết kế",
    retryScan: "Gửi lại lần quét này",
    dismiss: "Bỏ qua",
  },
  status: {
    owner: "Người đóng gói",
    startedAt: "Bắt đầu lúc",
    packedAt: "Đóng xong lúc",
    pick: "Lấy hàng",
    pack: "Đóng gói",
    you: "Bạn",
    waiting: "Chưa ai nhận",
  },
  notice: {
    waitingPick: "Chưa lấy hàng xong nên chưa đóng gói được.",
    viewOnly: "Bạn chỉ có quyền xem phiên đóng gói này.",
    readOnlyDone: "Đã đóng gói xong — không còn thao tác.",
    cancelled: "Đơn đã huỷ — phiên đóng gói đã đóng.",
    pendingStart: "Bấm Bắt đầu đóng gói để nhận đơn này tại bàn đóng gói.",
    holdTitle: "Đóng gói đang bị giữ do lệch thiết kế.",
    holdDescription:
      "Checksum file thiết kế không khớp bản khách đã chốt nên chưa giao được. Khôi phục đúng file rồi bấm Kiểm tra lại thiết kế (quản lý kho); sau đó phiên đóng gói trở lại đang đóng và người đóng bấm hoàn tất lần nữa.",
    holdReadOnly: "Chờ quản lý kho kiểm tra lại thiết kế.",
    takenTitle: (name: string) => `${name} đang đóng gói đơn này.`,
    takenAnonymous: "Một nhân viên khác đang đóng gói đơn này.",
    takenDescription: "Bạn chỉ xem được — chỉ người đã nhận đơn hoặc quản lý kho mới thao tác.",
    managerTitle: (name: string) => `${name} đã nhận đóng gói đơn này.`,
    managerDescription:
      "Bạn là quản lý kho nên vẫn thao tác được trong phiên này (người nhận đơn không đổi).",
    paymentTitle: "Đơn còn khoản phải thu trước khi bàn giao",
    paymentDescription: (amount: string) =>
      `Còn ${amount} phải thanh toán trước khi giao cho hãng. Vẫn đóng gói bình thường, nhưng bước bàn giao sẽ bị từ chối cho tới khi đơn được thanh toán.`,
    printWaitingTitle: "Hàng in chưa về bàn đóng gói",
    printWaitingDescription:
      "Dòng in chưa sẵn sàng — chỉ đóng được phần hàng có sẵn; muốn giao trước phần này thì đơn phải được Sale cho phép giao một phần. Hàng in sẽ về bàn đóng gói sau khi sản xuất xong.",
    refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
    voidedPackages: (labels: string) => `Kiện đã huỷ: ${labels}`,
  },
  lines: {
    title: "Dòng hàng của đơn",
    description: "Số cần đóng, đã đóng vào kiện và còn lại của từng dòng.",
    sku: "SKU",
    barcode: "Mã vạch",
    wanted: "Cần",
    available: "Đã về bàn",
    packed: "Đã đóng",
    shipped: "Đã giao",
    remaining: "Còn lại",
    lots: "Lô",
    printLine: "In theo thiết kế",
    lotTracked: "Theo lô",
    serialTracked: "Theo serial",
    done: "Đủ",
    printWaiting: "Chờ in",
    shortOfPicked: (available: number, wanted: number) =>
      `Mới có ${available}/${wanted} về bàn đóng gói`,
    lotCell: (lot: string, packed: number, available: number) => `${lot}: ${packed}/${available}`,
  },
  scan: {
    title: "Quét kiểm & đóng vào kiện",
    label: "Quét mã SKU hoặc mã vạch",
    placeholder: "Quét hoặc nhập mã rồi nhấn Enter",
    hint: "Ô quét luôn sẵn sàng nhận mã — dùng máy quét mã vạch hoặc gõ tay. Mỗi lần quét thêm số lượng bên cạnh vào kiện đang chọn.",
    targetPackage: "Kiện đang đóng",
    targetPlaceholder: "Chọn kiện",
    quantity: "Số lượng mỗi lần quét",
    noOpenPackage: "Chưa có kiện nào đang mở — mở một kiện mới để bắt đầu quét.",
    added: (qty: number, sku: string, no: number) => `Đã thêm ${qty} × ${sku} vào kiện ${no}`,
    failedTitle: "Lần quét chưa gửi được",
    failedNotSent: "Chưa gửi được — gửi lại sẽ dùng đúng mã lần quét cũ nên không bị trùng.",
    promptTitle: "Chi tiết hàng cần quét",
    promptDescription: (sku: string) => `Dòng ${sku} cần thêm thông tin trước khi đóng vào kiện.`,
    promptLine: "Dòng đơn hàng",
    promptLinePlaceholder: "Chọn dòng",
    promptLot: "Số lô",
    promptLotPlaceholder: "Quét hoặc gõ số lô",
    promptSerial: "Số serial",
    promptSerialHint: "Mỗi lần quét một đơn vị — quét serial của chiếc đang đóng.",
    promptSubmit: "Đóng vào kiện",
    lotOption: (lot: string, left: number) => `${lot} — còn ${left}`,
  },
  packages: {
    title: "Kiện",
    description: "Mỗi kiện có nhãn riêng; niêm phong sau khi cân và đo thực tế.",
    typeLabel: "Loại kiện",
    empty: "Chưa có kiện nào. Mở kiện đầu tiên để bắt đầu đóng hàng.",
    noContents: "Kiện còn trống.",
    colSku: "SKU",
    colLot: "Lô",
    colSerial: "Serial",
    colQty: "SL",
    weight: "Khối lượng",
    size: "Kích thước",
    dimWeight: "Quy đổi",
    rotatable: "Cho phép xoay",
    notRotatable: "Không xoay",
    fragile: "Dễ vỡ",
    overridden: "đã ghi đè",
    shipment: "Lô giao",
    sealedAt: "Niêm phong lúc",
    cardTitle: (no: number) => `Kiện ${no}`,
    voidConfirmTitle: "Huỷ kiện này?",
    voidConfirmDescription: (no: number) =>
      `Kiện ${no} bị huỷ cùng nhãn của nó; hàng trong kiện tính là chưa đóng và phải đóng lại. Không hoàn lại được.`,
    reopenConfirmTitle: "Mở lại kiện đã niêm phong?",
    reopenConfirmDescription: (no: number) =>
      `Kiện ${no} trở lại trạng thái đang mở để thêm / bớt hàng; phải cân, đo và niêm phong lại, nhãn đã in coi như tạm.`,
    typeOption: {
      CARTON: "Thùng carton",
      BAG: "Túi",
      PALLET: "Pallet",
      CRATE: "Thùng gỗ / sọt",
      OTHER: "Khác",
    },
    statusDisplay: {
      OPEN: "Đang mở",
      SEALED: "Đã niêm phong",
      VOIDED: "Đã huỷ",
      UNKNOWN: "Không rõ",
    },
  },
  remove: {
    title: "Bớt hàng khỏi kiện",
    description: (sku: string, no: number) =>
      `Lấy ${sku} ra khỏi kiện ${no}; số này tính là chưa đóng.`,
    quantity: "Số lượng bớt",
    submit: "Bớt hàng",
  },
  seal: {
    title: (no: number) => `Cân, đo & niêm phong kiện ${no}`,
    description:
      "BR-03 (docs 08): kiện phải có khối lượng và kích thước thực đo. Khối lượng quy đổi do hệ thống tính.",
    weight: "Khối lượng thực (kg)",
    length: "Dài (cm)",
    width: "Rộng (cm)",
    height: "Cao (cm)",
    packageType: "Loại kiện",
    rotatable: "Cho phép xoay",
    fragile: "Hàng dễ vỡ",
    flagFromSku: "Theo SKU bên trong (mặc định)",
    flagYes: "Có",
    flagNo: "Không",
    flagHint:
      "Để mặc định thì hệ thống tính từ SKU trong kiện; chọn Có / Không là ghi đè của người đóng.",
    submit: "Niêm phong",
  },
  complete: {
    title: "Hoàn tất đóng gói",
    description:
      "Mọi kiện đã niêm phong và chưa giao sẽ thành một lô giao sẵn sàng bàn giao. Đơn có dòng in sẽ được đối chiếu lại thiết kế trước khi giao.",
    modeFull: "Đóng đủ cả đơn",
    modeFullHint: "Mọi dòng đã đóng đủ số lượng cần.",
    modePartial: "Giao một phần",
    modePartialHint: "Giao trước những kiện đã niêm phong; phần còn lại đóng và giao sau.",
    fullBlocked: (count: number) => `Còn ${count} dòng chưa đóng đủ — chỉ giao được một phần.`,
    note: "Lý do giao một phần",
    notePlaceholder: "Vd: hết hàng dòng còn lại, khách đồng ý nhận trước",
    openPackagesTitle: "Còn kiện đang mở có hàng",
    openPackagesDescription: (labels: string) =>
      `Niêm phong hoặc huỷ ${labels} trước khi hoàn tất.`,
    nothingSealedTitle: "Chưa có kiện nào đã niêm phong",
    nothingSealedDescription: "Cân, đo và niêm phong ít nhất một kiện có hàng để giao.",
    missingTitle: "Dòng chưa đóng đủ",
    submitFull: "Hoàn tất đóng gói",
    submitPartial: "Giao một phần",
    resultShipped: "Đã tạo lô giao",
    resultShippedPartial: "Đã giao một phần — phần còn lại đóng và giao sau.",
    resultShippedFull: "Đã đóng gói xong cả đơn.",
    resultPackages: (count: number) => `${count} kiện`,
    resultLoading: "Đang tải lô giao vừa tạo…",
    resultHeld: "Lệch checksum thiết kế — đóng gói bị giữ, chưa tạo lô giao.",
    resultHeldHint: "Kiểm tra lại thiết kế (quản lý kho); sau đó người đóng hoàn tất lần nữa.",
    close: "Đóng",
  },
  shipments: {
    title: "Lô giao đã tạo",
    description:
      "Mỗi lần hoàn tất đóng gói tạo một lô giao; bàn giao hãng ở màn Xếp xe & bàn giao.",
    code: "Mã lô",
    status: "Trạng thái",
    packages: "Số kiện",
    cod: "Thu hộ (COD)",
    readyAt: "Sẵn sàng lúc",
    partial: "Giao một phần",
    hasCod: "Có thu hộ",
    noCod: "Không",
  },
  label: {
    title: (no: number) => `Nhãn kiện ${no}`,
    loading: "Đang tải nhãn…",
    provisional: "TẠM — chưa chốt",
    provisionalHint:
      "Kiện chưa nằm trong lô giao: số kiện n/N và tiền thu hộ tính theo các kiện đã niêm phong lúc này và có thể đổi khi niêm phong thêm.",
    order: "Đơn hàng",
    shipment: "Lô giao",
    parcelOf: (n: number, total: number) => `${n}/${total}`,
    recipient: "Người nhận",
    returnTo: "Hoàn hàng về",
    cod: "Thu hộ (COD)",
    noCod: "Không thu hộ",
    measures: "Cân & đo",
    flags: "Cờ",
    contents: "Nội dung",
    fragile: "DỄ VỠ",
    notRotatable: "KHÔNG XOAY",
    rotatable: "Cho phép xoay",
    noFlags: "Không có",
    unavailableTitle: "Chưa có nhãn",
    close: "Đóng",
    printHint: "In bằng trình duyệt; nhãn chỉ hiện nội dung cần dán lên kiện.",
  },
  field: {
    unknown: "—",
    items: "mặt hàng",
  },
} as const;

export const PACKING_TOAST_MESSAGES = {
  started: "Đã nhận đóng gói đơn này",
  packageOpened: "Đã mở kiện mới",
  sealed: "Đã niêm phong kiện",
  reopened: "Đã mở lại kiện",
  voided: "Đã huỷ kiện",
  removed: "Đã bớt hàng khỏi kiện",
  shipped: "Đã tạo lô giao",
  shippedPartial: "Đã giao một phần — phần còn lại đóng và giao sau",
  packed: "Đã đóng gói xong cả đơn",
  held: "Lệch checksum thiết kế — đóng gói bị giữ, chờ kiểm tra lại thiết kế",
} as const;

/** Lỗi nhập ở form quét / niêm phong / hoàn tất — hiện inline dưới ô. */
export const PACKING_FIELD_MESSAGES = {
  quantityRequired: "Nhập số lượng nguyên dương",
  quantityTooLarge: `Tối đa ${PACKING_LIMITS.quantityMax.toLocaleString("vi-VN")} mỗi lần`,
  quantityExceedsHeld: "Vượt quá số đang có trong kiện",
  lineRequired: "Chọn dòng đơn hàng",
  lotRequired: "Nhập hoặc quét số lô",
  lotUnknown: "Số lô này không có trong hàng đã lấy cho dòng",
  serialRequired: "Nhập số serial",
  serialTooLong: `Tối đa ${PACKING_LIMITS.serialMax} ký tự`,
  codeRequired: "Nhập mã cần quét",
  codeTooLong: `Tối đa ${PACKING_LIMITS.scannedCodeMax} ký tự`,
  weightInvalid: "Nhập khối lượng lớn hơn 0",
  weightTooLarge: "Khối lượng vượt giới hạn (tối đa 9.999.999,999 kg)",
  weightScale: "Khối lượng tối đa 3 chữ số thập phân",
  dimensionInvalid: "Nhập số lớn hơn 0",
  dimensionTooLarge: "Tối đa 100.000 cm",
  dimensionScale: "Tối đa 2 chữ số thập phân",
  noteRequired: "Ghi lý do giao một phần",
  noteTooLong: `Tối đa ${PACKING_LIMITS.noteMax} ký tự`,
} as const;

/**
 * BE `errorCode` (PR #136) → câu tiếng Việt. `VALIDATION_FAILED` không nằm ở đây: nội dung theo
 * `fieldErrors` (xem `packing-errors.ts`).
 */
export const PACKING_ERROR_MESSAGES = {
  // 404: task không có (kho ngoài phạm vi trả 403 OUT_OF_DATA_SCOPE, không phải 404)
  NOT_FOUND: "Không tìm thấy task đóng gói. Dữ liệu đã được tải lại.",
  PACKING_NOT_READY: "Chưa lấy hàng xong nên chưa đóng gói được.",
  PACKING_TAKEN: "Đơn này đang được nhân viên khác đóng gói.",
  PACK_STATE_CONFLICT:
    "Trạng thái đóng gói đã đổi nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  PACK_ITEM_NOT_IN_ORDER: "Mã vừa quét không có trong đơn hàng — để riêng, không cho vào kiện.",
  PACK_SCAN_AMBIGUOUS: "Mã này có ở nhiều dòng của đơn — chọn đúng dòng rồi quét lại.",
  PACK_SCAN_ID_CONFLICT: "Mã lần quét bị trùng với kiện hoặc task khác. Hãy quét lại.",
  PACK_QUANTITY_EXCEEDS_ORDER:
    "Vượt quá số lượng đơn còn cần của dòng này. Dữ liệu đã được tải lại.",
  PACK_QUANTITY_EXCEEDS_PICKED:
    "Vượt quá số hàng đã về bàn đóng gói của dòng này. Dữ liệu đã được tải lại.",
  PACK_LOT_MISMATCH: "Số lô này không có trong hàng đã lấy cho dòng, hoặc lô đã được đóng hết.",
  PACK_SERIAL_MISMATCH:
    "Số serial này không thuộc hàng đã lấy cho dòng, hoặc đã được đóng vào kiện.",
  PACKAGE_SEALED: "Kiện đã niêm phong — mở lại kiện trước khi thêm hoặc bớt hàng.",
  PACKAGE_EMPTY: "Kiện chưa có hàng nên chưa niêm phong được.",
  PACKAGE_NOT_SEALED: "Còn kiện đang mở có hàng — niêm phong hoặc huỷ kiện đó trước khi hoàn tất.",
  PACKAGE_SHIPPED: "Kiện đã nằm trong lô giao nên không sửa được.",
  PACKING_INCOMPLETE: "Chưa đóng đủ hàng của đơn. Đóng nốt, hoặc chọn giao một phần và ghi lý do.",
  // BE PR #150: giao một phần do Sales bật trên đơn (kho không còn tự quyết); cũng trả khi đóng gói
  // hàng có sẵn của đơn đang sản xuất mà đơn chưa được phép giao một phần
  PACK_PARTIAL_NOT_ALLOWED: "Đơn chưa được phép giao một phần — nhờ Sale bật trên đơn",
  PACK_NOTHING_TO_SHIP: "Chưa có kiện nào đã niêm phong đang chờ giao.",
  PACKAGE_NOT_FOUND: "Không tìm thấy kiện (có thể đã bị huỷ ở nơi khác). Dữ liệu đã được tải lại.",
  OUT_OF_DATA_SCOPE: "Đơn này thuộc kho ngoài phạm vi bạn được thao tác.",
  ORDER_CANCELLED: "Đơn hàng đã huỷ nên phiên đóng gói đã đóng.",
} as const;

/**
 * Phản hồi của BE sai hợp đồng (zod parse lỗi): BE có thể ĐÃ ghi lần quét / thao tác, nên không gửi lại
 * mù quáng — phiên được tải lại để xem kết quả thật.
 */
export const PACKING_INVALID_RESPONSE_MESSAGE =
  "Máy chủ trả dữ liệu sai định dạng — thao tác có thể đã được ghi. Phiên đã được tải lại, kiểm tra trước khi quét tiếp.";

/** Mã lỗi nghiệp vụ đóng gói — dữ liệu phiên đã đổi ở nơi khác thì tải lại (xem `packing-errors.ts`). */
export const PACKING_STALE_ERROR_CODES = [
  "PACKING_NOT_READY",
  "PACKING_TAKEN",
  "PACK_STATE_CONFLICT",
  "PACK_QUANTITY_EXCEEDS_ORDER",
  "PACK_QUANTITY_EXCEEDS_PICKED",
  "PACKAGE_SEALED",
  "PACKAGE_EMPTY",
  "PACKAGE_NOT_SEALED",
  "PACKAGE_SHIPPED",
  "PACKAGE_NOT_FOUND",
  "PACK_LOT_MISMATCH",
  "PACKING_INCOMPLETE",
  "PACK_NOTHING_TO_SHIP",
  "ORDER_CANCELLED",
] as const;

/** Tên field BE (`FieldError.field`) của `VALIDATION_FAILED` → câu tiếng Việt. */
export const PACKING_VALIDATION_FIELD_MESSAGES = {
  weightKg: PACKING_FIELD_MESSAGES.weightInvalid,
  lengthCm: PACKING_FIELD_MESSAGES.dimensionInvalid,
  widthCm: PACKING_FIELD_MESSAGES.dimensionInvalid,
  heightCm: PACKING_FIELD_MESSAGES.dimensionInvalid,
  lotNumber: "Hàng này theo dõi theo lô — chọn số lô rồi quét lại.",
  serialNumber: "Hàng này theo dõi theo serial — quét serial của từng đơn vị.",
  scannedCode: PACKING_FIELD_MESSAGES.codeRequired,
  quantity: "Số lượng phải từ 1 đến 1.000.000.",
  note: PACKING_FIELD_MESSAGES.noteRequired,
} as const;
