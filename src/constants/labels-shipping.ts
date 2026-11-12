/**
 * Nhãn, thông báo và lỗi của các màn giao cho hãng vận chuyển: lô giao, chuyến xe (một xe của kế hoạch xếp xe), quét
 * kiện lên xe, mã vận đơn, biên bản bàn giao, kết quả giao (docs 09 §4). Chỉ giao nguyên chuyến, không thu hộ (BR-08).
 */

import { SHIPPING_FTL_LABELS, SHIPPING_FTL_TOAST_MESSAGES } from "./labels-shipping-ftl";
import {
  SHIPPING_WAYBILL_LABELS,
  SHIPPING_WAYBILL_TOAST_MESSAGES,
} from "./labels-shipping-waybill";
import { SHIPPING_LIMITS } from "./numbers";

export const SHIPPING_UI_LABELS = {
  pageTitle: "Giao cho hãng vận chuyển",
  ftl: SHIPPING_FTL_LABELS,
  waybill: SHIPPING_WAYBILL_LABELS,
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với giao hàng.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu giao hàng. Liên hệ quản trị để được cấp.",
  notFoundTitle: "Không tìm thấy",
  notFoundDescription: "Chuyến xe hoặc lô giao không tồn tại, hoặc đường dẫn không hợp lệ.",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  none: "—",
  field: {
    warehouse: "Kho giao",
    warehousePlaceholder: "Chọn kho",
    carrier: "Hãng vận chuyển",
    carrierNone: "Chưa chọn hãng",
    carrierPlaceholder: "Chọn hãng",
    vehiclePlate: "Biển số xe",
    driverName: "Tài xế",
    driverPhone: "SĐT tài xế",
    note: "Ghi chú",
    weight: "Cân nặng",
    weightUnit: "kg",
  },
  /* ── Lô giao ─────────────────────────────────────────────────────── */
  shipments: {
    title: "Lô giao",
    subtitle:
      "Mỗi lô giao sinh ra khi hoàn tất kiểm thùng một đơn; lô đi theo xe của kế hoạch xếp xe và được ghi nhận kết quả giao sau khi bàn giao.",
    searchPlaceholder: "Tìm theo mã lô giao",
    searchScope: "Mã lô giao",
    listCaption: "lô giao",
    refetching: "Đang tải lại danh sách lô giao",
    statusFilter: "Trạng thái",
    warehouseFilter: "Kho",
    carrierFilter: "Hãng",
    all: "Tất cả",
    clearFilters: "Xoá bộ lọc",
    filterLoadFailed: "Không tải được danh sách kho / hãng.",
    onLoad: "Trên chuyến",
    partial: "Giao một phần",
    empty: {
      noDataTitle: "Chưa có lô giao",
      noDataDescription:
        "Lô giao được tạo khi hoàn tất đóng gói một đơn — chưa có lô nào ở trạng thái này.",
      noResultsDescription: "Không có lô giao nào khớp từ khoá hoặc bộ lọc hiện tại.",
    },
  },
  /* ── Chuyến xe ────────────────────────────────────────────────────── */
  loads: {
    title: "Chuyến xe",
    subtitle:
      "Mỗi chuyến là một xe của kế hoạch xếp xe: đặt xe với hãng, nhập mã vận đơn, quét kiện lên xe, in biên bản, hai bên ký.",
    searchPlaceholder: "Tìm theo mã chuyến, biển số hoặc mã kế hoạch",
    searchScope: "Mã chuyến, biển số xe, mã kế hoạch",
    listCaption: "chuyến xe",
    refetching: "Đang tải lại danh sách chuyến xe",
    openRow: "Mở chuyến",
    waybillColumn: "Mã vận đơn",
    importWaybills: "Nhập mã vận đơn từ file",
    empty: {
      noDataTitle: "Chưa có chuyến xe",
      noDataDescription:
        "Chuyến xe sinh ra khi chốt một kế hoạch xếp xe — mỗi xe của kế hoạch là một chuyến.",
      noResultsDescription: "Không có chuyến xe nào khớp từ khoá hoặc bộ lọc hiện tại.",
    },
  },
  /* ── Chi tiết chuyến / quét ──────────────────────────────────────── */
  load: {
    title: "Chuyến xe",
    code: "Mã chuyến",
    back: "Danh sách chuyến",
    info: "Thông tin chuyến",
    startedAt: "Bắt đầu xếp lúc",
    dispatchedAt: "Bàn giao lúc",
    dispatchedBy: "Người bàn giao",
    representative: "Người ký bên hãng",
    signatureRef: "Mã biên bản đã ký",
    handoverNote: "Ghi chú bàn giao",
    cancelledAt: "Huỷ lúc",
    cancelReason: "Lý do huỷ",
    shipmentCount: "Lô giao",
    progress: "Kiện đã lên xe / cần lên",
    progressAria: "Kiện đã lên xe",
    shipmentsTitle: "Lô giao trên chuyến",
    shipmentLoaded: "kiện lên xe",
    shipmentComplete: "Đủ kiện",
    parcels: "Kiện",
    parcelCode: "Mã kiện",
    parcelWeight: "Cân nặng (kg)",
    parcelLoadedAt: "Lên xe lúc",
    notLoaded: "Chưa lên xe",
    unscan: "Gỡ khỏi xe",
    unscanAria: "Gỡ kiện khỏi xe",
    openShipment: "Xem lô",
    noShipments: "Chuyến chưa có lô giao nào.",
    refusalTitle: "Lô này đang chặn việc bàn giao",
    refusalHint:
      "Xử lý đơn của lô này; muốn xe đi mà không có lô này thì dỡ kiện của nó bằng huỷ có kiểm soát xe.",
    dismissRefusal: "Ẩn",
    actions: {
      manifest: "Biên bản bàn giao",
      handover: "Xác nhận bàn giao",
      refresh: "Tải lại",
    },
    disabledReason: {
      empty: "Chuyến chưa có lô giao nào — không có gì để bàn giao.",
      notFullyLoaded: "Còn kiện chưa quét lên xe.",
    },
    noActions: {
      viewOnly:
        "Bạn chỉ có quyền xem chuyến xe — quét kiện và bàn giao cần quyền xếp xe & bàn giao.",
      dispatched: "Đã bàn giao cho hãng vận chuyển.",
      cancelled: "Chuyến đã huỷ.",
    },
  },
  scan: {
    label: "Quét mã kiện",
    placeholder: "Quét hoặc nhập mã kiện rồi nhấn Enter",
    hint: "Ô quét luôn sẵn sàng nhận mã — dùng máy quét mã vạch hoặc gõ tay.",
    accepted: "Đã lên xe",
    notLoaded: "Máy chủ chưa xếp kiện này lên xe — quét lại.",
    rejectedTitle: "Mã quét không thành công — chưa lên xe",
    clearRejected: "Xoá danh sách",
    notSent: "Chưa gửi được — quét lại cùng mã để thử lại.",
    invalidResponse:
      "Máy chủ trả dữ liệu sai định dạng — kiểm tra bảng kiện trước khi quét lại, báo kỹ thuật.",
  },
  /* ── Bàn giao + biên bản ─────────────────────────────────────────── */
  handover: {
    title: "Xác nhận bàn giao",
    description:
      "Hai bên đã ký biên bản giấy của riêng xe này. Chuyến chuyển sang Đã bàn giao; mỗi lô chỉ chuyển Đã bàn giao ở xe cuối cùng chở nó.",
    representative: "Người ký bên hãng (tài xế)",
    vehiclePlate: "Biển số xe",
    driverPhone: "SĐT tài xế",
    signatureRef: "Mã / số biên bản giấy đã ký",
    signatureRefHint: "Không bắt buộc — dùng để đối chiếu bản giấy hoặc bản scan.",
    note: "Ghi chú bàn giao",
    signedConfirm: "Hai bên đã ký biên bản giấy",
    signedHint: "Bắt buộc trước khi xác nhận bàn giao.",
    rejectedPending:
      "Có mã quét không thành công ở màn xếp hàng — kiểm tra các kiện này không nằm trên xe trước khi bàn giao:",
    done: {
      title: "Đã bàn giao",
      description: "Chuyến đã chuyển sang Đã bàn giao. Các lô sau đã đi cùng hãng:",
      close: "Đóng",
      manifest: "Xem biên bản",
    },
  },
  manifest: {
    title: "Biên bản bàn giao",
    docTitle: "Biên bản bàn giao hàng cho hãng vận chuyển",
    loadPrefix: "Chuyến:",
    printedAt: "In lúc",
    print: "In biên bản",
    back: "Về chuyến xe",
    warehouse: "Kho giao",
    warehouseAddress: "Địa chỉ kho",
    carrierContact: "Liên hệ hãng",
    handedOverAt: "Thời điểm bàn giao",
    handedOverBlank: "…… giờ …… ngày ……",
    shipment: "Lô giao",
    order: "Đơn hàng",
    recipient: "Người nhận",
    address: "Địa chỉ giao",
    packages: "Số kiện",
    weight: "Cân nặng (kg)",
    parcelCode: "Mã kiện",
    dimensions: "Kích thước (cm)",
    loaded: "Đã lên xe",
    notLoaded: "Chưa lên xe",
    totals: "Tổng",
    totalShipments: "Số lô:",
    totalPackages: "Số kiện:",
    totalWeight: "Tổng cân nặng:",
    note: "Ghi chú:",
    signatureRef: "Mã biên bản đã ký:",
    warehouseSign: "Đại diện kho",
    carrierSign: "Đại diện hãng vận chuyển",
    signNote: "Ký, ghi rõ họ tên",
    draftBanner: "BẢN ĐỐI SOÁT — CHƯA ĐỦ KIỆN, KHÔNG DÙNG ĐỂ KÝ BÀN GIAO",
    printBlocked: "Chỉ in biên bản để ký khi đã quét đủ kiện của mọi lô trên chuyến.",
    reconcileHint:
      "Đối soát biên bản với kiện đã lên xe. Đủ kiện thì in, hai bên ký rồi xác nhận bàn giao ở màn chuyến.",
    dispatchedHint: "Chuyến đã bàn giao — đây là bản biên bản đã ký.",
    missingPrefix: "Thiếu",
    packagesUnit: "kiện",
  },
  /* ── Chi tiết lô giao + kết quả giao ─────────────────────────────── */
  shipment: {
    title: "Lô giao",
    code: "Mã lô",
    back: "Danh sách lô giao",
    info: "Thông tin lô",
    order: "Đơn hàng",
    openOrder: "Xem đơn",
    readyAt: "Sẵn sàng xuất lúc",
    handedOverAt: "Bàn giao lúc",
    outcomeAt: "Ghi nhận kết quả lúc",
    failureReason: "Lý do giao thất bại",
    failureNote: "Ghi chú nội bộ",
    partialNote: "Ghi chú giao một phần",
    wholeOrder: "Bàn giao theo cả đơn (trước khi có chuyến) — kết quả ghi nhận theo đơn.",
    onLoad: "Chuyến",
    packages: "Kiện trong lô",
    parcelCode: "Mã kiện",
    parcelStatus: "Trạng thái kiện",
    timeline: "Lịch sử",
    timelineWho: "Người ghi nhận",
    timelineNote: "Ghi chú",
    timelineEmpty: "Chưa có bước nào được ghi.",
    outcomeCard: "Kết quả giao",
    carrierCard: "Hãng vận chuyển",
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem lô giao.",
      readyToDispatch: "Lô chưa bàn giao — kết quả giao chỉ ghi nhận sau khi hãng đã nhận hàng.",
      terminal: "Lô đã có kết quả cuối — không còn thao tác.",
      needsApproval:
        'Bạn chỉ ghi nhận được hàng hoàn về kho — "đã giao" / "giao thất bại" cần quyền phê duyệt kết quả giao.',
    },
    outcomeAction: {
      DELIVERED: "Ghi nhận đã giao",
      DELIVERY_FAILED: "Ghi nhận giao thất bại",
      RETURNED: "Ghi nhận hàng hoàn về kho",
    },
    outcomeDialog: {
      DELIVERED: {
        title: "Ghi nhận đã giao",
        description:
          "Hãng báo đã giao thành công. Đơn chuyển trạng thái theo các lô; đơn công nợ ghi nhận khoản phải thu.",
      },
      DELIVERY_FAILED: {
        title: "Ghi nhận giao thất bại",
        description:
          "Hãng báo không giao được. Chọn lý do; hãng có thể giao lại, hoặc hàng hoàn về kho.",
      },
      RETURNED: {
        title: "Ghi nhận hàng hoàn về kho",
        description: "Hãng đã trả kiện về kho. Nhập lại tồn qua luồng Nhận hàng (hàng hoàn).",
      },
      reason: "Lý do",
      reasonPlaceholder: "Chọn lý do",
      note: "Ghi chú nội bộ",
      noteRequired: 'Bắt buộc khi lý do là "Lý do khác". Chỉ nhân viên xem, không hiện cho khách.',
      noteOptional: "Không bắt buộc. Chỉ nhân viên xem, không hiện cho khách.",
      confirm: "Ghi nhận",
    },
  },
  orderShipments: {
    open: "Xem lô giao",
  },
} as const;

export const SHIPPING_TOAST_MESSAGES = {
  unscanned: "Đã gỡ kiện khỏi xe",
  handedOver: "Đã bàn giao chuyến cho hãng vận chuyển",
  outcomeRecorded: "Đã ghi nhận kết quả giao",
  ...SHIPPING_FTL_TOAST_MESSAGES,
  ...SHIPPING_WAYBILL_TOAST_MESSAGES,
} as const;

/**
 * errorCode BE (`ErrorCode.java`) → câu tiếng Việt. Khi BE nêu tên lô giao
 * (`fieldErrors.shipmentCode`) câu được thêm tiền tố "Lô <mã>".
 */
export const SHIPPING_ERROR_MESSAGES = {
  // 400
  HANDOVER_NOT_SIGNED: "Hai bên phải ký biên bản — tick xác nhận đã ký rồi bàn giao lại.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ — kiểm tra lại các ô đã nhập.",
  // 403 / 404
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho của chuyến / lô giao này.",
  LOAD_NOT_FOUND: "Không tìm thấy chuyến xe.",
  SHIPMENT_NOT_FOUND: "Không tìm thấy lô giao.",
  CARRIER_NOT_FOUND: "Không tìm thấy hãng vận chuyển.",
  PACKAGE_NOT_FOUND: "Không tìm thấy kiện với mã này.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho.",
  // 409 — quét kiện
  PACKAGE_NOT_IN_LOAD:
    "Kiện không có trong biên bản của chuyến này (lô khác, kho khác, hoặc kế hoạch xếp kiện này lên xe khác) — không xếp lên xe.",
  PACKAGE_ALREADY_LOADED: "Kiện đã nằm trên chuyến xe khác — không xếp lên xe này.",
  PACKAGE_NOT_READY:
    "Kiện chưa sẵn sàng bàn giao (chưa niêm phong, chưa vào lô giao, hoặc lô đã huỷ / đã đi).",
  LOAD_SCAN_ID_CONFLICT:
    "Lần quét này đã dùng cho kiện hoặc chuyến khác — quét lại để tạo lần quét mới.",
  // 409 — lô trên chuyến
  SHIPMENT_NOT_FOR_LOAD: "Lô này không đi trên chuyến này.",
  SHIPMENT_ON_ANOTHER_LOAD: "Lô này đang nằm trên chuyến xe khác.",
  SHIPMENT_STATE_CONFLICT: "Lô giao không làm được thao tác này ở trạng thái hiện tại.",
  // 409 / 404 — hãng và đặt xe
  CARRIER_INACTIVE: "Hãng này đã ngừng sử dụng — chọn hãng khác.",
  CARRIER_CODE_EXISTS: "Mã hãng này đã có trong danh mục — dùng mã khác.",
  CARRIER_BOOKS_THROUGH_API:
    "Hãng này đặt xe qua API — nhập giờ hẹn lấy hàng để hệ thống tạo đơn ở hãng, không ghi nhận tay.",
  CARRIER_BOOKING_IN_PROGRESS:
    "Chuyến này đang được đặt (hoặc đã đặt) qua API của hãng — huỷ đặt xe trước rồi đặt lại.",
  CARRIER_PICKUP_NOT_CONFIGURED:
    "Hãng chưa khai báo điểm lấy hàng ở kho này — nhờ quản lý kho cấu hình kết nối hãng.",
  CARRIER_SERVICE_NOT_CONFIGURED:
    "Hãng chưa có mã dịch vụ cho loại xe này ở khu vực của kho — nhờ quản lý kho cấu hình kết nối hãng.",
  CARRIER_STOP_OUT_OF_AREA:
    "Có điểm giao nằm ngoài khu vực hãng phục vụ — chọn hãng khác hoặc huỷ có kiểm soát để dỡ lô đó.",
  CARRIER_BOOKING_FAILED: "Hãng từ chối tạo đơn đặt xe.",
  CARRIER_CANCEL_REFUSED:
    "Hãng không huỷ đơn được (tài xế đã lấy hàng) — liên hệ trực tiếp với hãng để xử lý.",
  SECRETS_UNAVAILABLE: "Hệ thống chưa lưu được khoá bí mật lúc này — thử lại sau.",
  EXTERNAL_SERVICE_ERROR:
    "Hãng không phản hồi và có thể đã tạo đơn: kiểm tra trên cổng của hãng (đơn ghi chú mã chuyến), huỷ ở đó nếu có, rồi huỷ đặt xe và đặt lại.",
  // 409 — mã vận đơn (BR-23, BR-24)
  WAYBILL_DUPLICATE:
    "Một chuyến khác của hãng này đã dùng mã vận đơn đó — mã vận đơn là duy nhất trong cùng một hãng.",
  WAYBILL_FROM_CARRIER_API:
    "Mã vận đơn của hãng này do API đặt xe cấp — không nhập tay; muốn đổi thì huỷ đặt xe và đặt lại.",
  LOAD_WAYBILL_MISSING:
    "Chuyến chưa có mã vận đơn — nhập mã vận đơn của hãng trước khi ký bàn giao.",
  WAYBILL_IMPORT_INVALID_FILE:
    "File không đúng mẫu nhập mã vận đơn (cần CSV UTF-8, có dòng tiêu đề và ít nhất một dòng dữ liệu, tối đa 1.000 dòng, 1 MB).",
  // 409 — chuyến
  INVALID_LOAD_TRANSITION: "Trạng thái chuyến đã đổi ở nơi khác — thao tác chưa được thực hiện.",
  LOAD_NOT_FULLY_LOADED:
    "Còn kiện kế hoạch xếp lên xe này chưa quét — quét đủ mọi kiện của xe rồi ký bàn giao.",
  LOAD_UNLOAD_PENDING: "Xe còn kiện của đơn đã huỷ — dỡ các kiện đó xuống trước khi bàn giao.",
  // SCRUM-474 UNLOAD-DESIGN: kiện của xe đã huỷ có kiểm soát bị khoá tới khi quét dỡ xuống
  PACKAGE_UNLOAD_PENDING:
    "Kiện này còn nằm trên xe đã huỷ có kiểm soát — quét dỡ kiện xuống ở chuyến đó trước khi xếp lên xe khác.",
  LOAD_PLAN_VEHICLE_DISPATCHED:
    "Đã có xe của kế hoạch rời kho nên không huỷ cả kế hoạch được — huỷ có kiểm soát từng xe còn lại.",
  INVALID_LOAD_PLAN_TRANSITION:
    "Kế hoạch xếp xe chưa ở trạng thái Đã chốt — đặt xe, bắt đầu xếp hàng và bàn giao chỉ làm được khi kế hoạch đã chốt.",
  LOAD_EMPTY: "Chuyến chưa có lô giao nào — không có gì để bàn giao.",
  OPTIMISTIC_LOCK: "Chuyến vừa được cập nhật ở nơi khác — đã tải lại, kiểm tra rồi thử lại.",
  LOCK_TIMEOUT: "Hệ thống đang bận xử lý chuyến này — thử lại sau vài giây.",
  CONFLICT: "Yêu cầu này đã được xử lý — thử lại.",
  // 409 — chặn bàn giao (09 BR-18: tất cả hoặc không). Danh sách đơn nằm ở `details.orders`, xem `errors.ts`
  LOAD_HANDOVER_BLOCKED:
    "Có đơn trên xe chưa được phép đi — cả xe bị từ chối bàn giao cho tới khi xử lý từng đơn.",
  DELIVERY_BATCH_WINDOW_NOT_OPEN:
    "Đợt giao của đơn chưa tới ngày bắt đầu cửa sổ giao — nhờ Sale dời cửa sổ giao nếu khách nhận sớm.",
  ORDER_BALANCE_NOT_PAID:
    "Đơn trên xe còn đợt thanh toán trước khi giao chưa thu — chưa bàn giao được.",
  ORDER_INVALID_TRANSITION: "Đơn của lô này đang tạm giữ hoặc không ở trạng thái cho bàn giao.",
  ORDER_CANCELLED: "Đơn của lô này đã huỷ.",
  // BE PR #150: lô sẽ tách đơn ra nhiều lần giao mà Sales chưa cho phép giao một phần
  ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED:
    "Đơn của lô này chưa được phép giao một phần — nhờ Sale bật “Cho phép giao một phần” trên đơn, hoặc đưa các lô còn lại của đơn đi cùng xe.",
  // BE gắn tên lô vào mọi từ chối phía đơn khi bàn giao (đơn huỷ, lô xung đột, vượt số lượng…)
  shipmentRefused:
    "Đơn của lô này không cho phép bàn giao lúc này (đơn huỷ, lô xung đột hoặc vượt số lượng).",
  generic: "Không thực hiện được thao tác. Thử lại sau.",
} as const;

export const SHIPPING_FIELD_MESSAGES = {
  scanRequired: "Nhập mã kiện",
  scanTooLong: `Mã kiện quá dài (tối đa ${SHIPPING_LIMITS.scanCodeMax} ký tự)`,
  scanNotAscii: "Mã có ký tự có dấu / khoảng trắng — tắt bộ gõ tiếng Việt rồi quét lại.",
  tooLong: "Quá dài",
  required: "Bắt buộc",
  warehouseRequired: "Chọn kho",
  carrierRequired: "Chọn hãng vận chuyển",
  cancelBookingReasonRequired: "Nhập lý do huỷ đặt xe",
  // SCRUM-474 UNLOAD-DESIGN điểm 7: mã lý do + ghi chú
  controlledReasonCodeRequired: "Chọn lý do huỷ",
  controlledNoteRequired: "Nhập ghi chú cho lý do huỷ",
  carrierRepresentativeRequired: "Nhập tên người ký bên hãng",
  vehiclePlateRequired: "Nhập biển số xe",
  signedRequired: "Xác nhận hai bên đã ký biên bản",
  reasonRequired: "Chọn lý do",
  noteRequiredForOther: "Lý do khác phải ghi chú rõ",
  waybillRequired: "Nhập mã vận đơn",
  waybillInvalid: `Mã vận đơn gồm 1–${SHIPPING_LIMITS.waybillNoMax} ký tự in được, không có khoảng trắng — tắt bộ gõ tiếng Việt nếu có dấu.`,
  waybillReasonRequired: "Chuyến đã rời kho: nhập lý do sửa mã vận đơn",
  carrierCodeInvalid: `Mã hãng ${SHIPPING_LIMITS.carrierCodeMin}–${SHIPPING_LIMITS.carrierCodeMax} ký tự: chữ, số, “-” hoặc “_”, bắt đầu bằng chữ hoặc số`,
  carrierNameRequired: "Nhập tên hãng",
  webhookSecretInvalid: `Khoá bí mật ${SHIPPING_LIMITS.webhookSecretMin}–${SHIPPING_LIMITS.webhookSecretMax} ký tự, không có khoảng trắng đầu / cuối`,
} as const;
