/**
 * Nhãn, thông báo và lỗi của các màn giao cho hãng vận chuyển: lô giao chờ xuất, chuyến xe, quét kiện
 * lên xe, biên bản bàn giao, kết quả giao (docs 09 §4, BE PR #137 SCRUM-288/292/293).
 * Hãng vận chuyển là bên thứ ba: không mã vận đơn, không theo dõi hành trình (rescope 2026-10-06).
 */

import { SHIPPING_FTL_LABELS, SHIPPING_FTL_TOAST_MESSAGES } from "./labels-shipping-ftl";
import { SHIPPING_LIMITS } from "./numbers";

export const SHIPPING_UI_LABELS = {
  pageTitle: "Giao cho hãng vận chuyển",
  // Màn Kế hoạch xếp xe 3D (SCRUM-287 / 452) — chưa làm
  ftl: SHIPPING_FTL_LABELS,
  loadPlanTitle: "Kế hoạch xếp xe",
  loadPlanInProgress: "Đang phát triển",
  noTracking:
    "Hãng vận chuyển là bên thứ ba — không có mã vận đơn và không theo dõi hành trình sau khi bàn giao.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với giao hàng.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu giao hàng. Liên hệ quản trị để được cấp.",
  notFoundTitle: "Không tìm thấy",
  notFoundDescription: "Chuyến xe hoặc lô giao không tồn tại, hoặc đường dẫn không hợp lệ.",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  none: "—",
  field: {
    warehouse: "Kho giao",
    carrier: "Hãng vận chuyển",
    carrierNone: "Chưa chọn hãng",
    vehiclePlate: "Biển số xe",
    driverName: "Tài xế",
    driverPhone: "SĐT tài xế",
    cod: "Thu hộ (COD)",
    note: "Ghi chú",
    weight: "Cân nặng",
    weightUnit: "kg",
  },
  /* ── Lô giao chờ xuất ─────────────────────────────────────────────── */
  shipments: {
    title: "Lô giao",
    subtitle:
      "Lô giao đã đóng gói chờ bàn giao: chọn hãng cho từng lô, rồi mở chuyến khi tài xế tới.",
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
    openLoad: "Mở chuyến với lô đã chọn",
    selected: "đã chọn",
    selectHint: "Chọn các lô cùng kho để mở chuyến khi tài xế hãng tới.",
    mixedWarehouses: "Các lô đã chọn thuộc nhiều kho — mỗi chuyến chỉ đi từ một kho.",
    onLoad: "Trên chuyến",
    partial: "Giao một phần",
    carrierSelectLabel: "Hãng của lô",
    hasCod: "Có thu hộ",
    noCod: "Không thu hộ",
    onAnotherLoad: "Lô đã nằm trên chuyến khác — bỏ khỏi chuyến đó trước.",
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
      "Mỗi chuyến là một lần bàn giao cho một hãng: quét kiện lên xe, in biên bản, hai bên ký.",
    searchPlaceholder: "Tìm theo mã chuyến, biển số hoặc mã kế hoạch",
    searchScope: "Mã chuyến, biển số xe, mã kế hoạch",
    listCaption: "chuyến xe",
    refetching: "Đang tải lại danh sách chuyến xe",
    open: "Mở chuyến",
    openRow: "Mở chuyến",
    empty: {
      noDataTitle: "Chưa có chuyến xe",
      noDataDescription: "Mở chuyến khi tài xế hãng tới lấy hàng, hoặc từ danh sách lô giao.",
      noResultsDescription: "Không có chuyến xe nào khớp từ khoá hoặc bộ lọc hiện tại.",
    },
  },
  /* ── Mở chuyến ───────────────────────────────────────────────────── */
  openDialog: {
    title: "Mở chuyến xe",
    description:
      "Tài xế hãng đã tới: mở chuyến để quét kiện lên xe. Bỏ trống danh sách lô để lấy các lô của kho đã gán cho hãng này.",
    shipmentsLabel: "Lô giao đưa lên chuyến",
    shipmentsAuto: "Các lô chờ xuất của kho đã gán cho hãng này (hệ thống tự lấy)",
    warehouse: "Kho",
    warehousePlaceholder: "Chọn kho",
    carrier: "Hãng vận chuyển",
    carrierPlaceholder: "Chọn hãng",
    vehiclePlate: "Biển số xe",
    driverName: "Tên tài xế",
    driverPhone: "SĐT tài xế",
    submit: "Mở chuyến",
    mixedCarriers: "Các lô đã chọn đã gán hãng khác nhau — chọn lại hãng cho đồng nhất.",
  },
  /* ── Chi tiết chuyến / quét ──────────────────────────────────────── */
  load: {
    title: "Chuyến xe",
    code: "Mã chuyến",
    back: "Danh sách chuyến",
    info: "Thông tin chuyến",
    modeLabel: "Hình thức giao",
    mode: { PARCEL: "Gửi kiện", FULL_TRUCKLOAD: "Nguyên xe", UNKNOWN: "Không rõ" },
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
    codTotal: "Tổng thu hộ",
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
    removeShipment: "Bỏ lô khỏi chuyến",
    addShipments: "Thêm lô",
    openShipment: "Xem lô",
    noShipments: "Chuyến chưa có lô giao nào — thêm lô để bắt đầu quét.",
    labelCod: "COD trên nhãn",
    fixedCod: "COD chốt khi bàn giao",
    refusalTitle: "Lô này đang chặn việc bàn giao",
    refusalHint: "Xử lý lô này, hoặc bỏ nó khỏi chuyến để các lô còn lại đi trước.",
    reprintLabel: "Mở danh sách task để in lại nhãn",
    reprintHint:
      "Nhãn kiện in lại ở trạm đóng gói của đơn: mở task của đơn này → Đóng gói → in lại nhãn kiện, rồi ký bàn giao lại.",
    dismissRefusal: "Ẩn",
    actions: {
      manifest: "Biên bản bàn giao",
      handover: "Xác nhận bàn giao",
      cancel: "Huỷ chuyến",
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
      cancelled: "Chuyến đã huỷ — kiện đã về khu chờ xuất.",
    },
    cancelDialog: {
      title: "Huỷ chuyến xe",
      description:
        "Các lô và kiện đã quét trở về khu chờ xuất, chưa đi đâu. Chỉ huỷ được khi xe chưa rời kho.",
      reason: "Lý do huỷ",
      confirm: "Huỷ chuyến",
    },
    addDialog: {
      title: "Thêm lô vào chuyến",
      description: "Lô chờ xuất của cùng kho, đã gán hãng của chuyến này hoặc chưa gán hãng.",
      empty: "Không còn lô nào chờ xuất cho hãng này.",
      submit: "Thêm lô đã chọn",
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
      "Hai bên đã ký biên bản giấy: các lô trên chuyến chuyển sang Đã bàn giao, thu hộ chốt theo đơn; đơn chuyển Đã gửi khi mọi lô của đơn đã đi.",
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
    cod: "Thu hộ (COD)",
    parcelCode: "Mã kiện",
    dimensions: "Kích thước (cm)",
    loaded: "Đã lên xe",
    notLoaded: "Chưa lên xe",
    codChanged: "COD đã đổi so với nhãn — thu theo số này",
    totals: "Tổng",
    totalShipments: "Số lô:",
    totalPackages: "Số kiện:",
    totalWeight: "Tổng cân nặng:",
    totalCod: "Tổng thu hộ:",
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
    mode: { PARCEL: "Gửi kiện", FULL_TRUCKLOAD: "Nguyên xe", UNKNOWN: "Không rõ" },
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
    carrierLocked: "Lô đang nằm trên chuyến — bỏ lô khỏi chuyến trước khi đổi hãng.",
    carrierSave: "Lưu hãng",
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
  loadOpened: "Đã mở chuyến xe",
  shipmentsAdded: "Đã thêm lô vào chuyến",
  shipmentRemoved: "Đã bỏ lô khỏi chuyến",
  unscanned: "Đã gỡ kiện khỏi xe",
  handedOver: "Đã bàn giao chuyến cho hãng vận chuyển",
  cancelled: "Đã huỷ chuyến xe",
  carrierSaved: "Đã lưu hãng vận chuyển của lô",
  carrierCleared: "Đã bỏ hãng của lô",
  outcomeRecorded: "Đã ghi nhận kết quả giao",
  ...SHIPPING_FTL_TOAST_MESSAGES,
} as const;

/**
 * errorCode BE (`ErrorCode.java`, PR #137 + mã chung) → câu tiếng Việt. Khi BE nêu tên lô giao
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
    "Kiện không có trong biên bản của chuyến này (lô khác, kho khác, hoặc lô chưa thêm vào chuyến) — không xếp lên xe.",
  PACKAGE_ALREADY_LOADED: "Kiện đã nằm trên chuyến xe khác — không xếp lên xe này.",
  PACKAGE_NOT_READY:
    "Kiện chưa sẵn sàng bàn giao (chưa niêm phong, chưa vào lô giao, hoặc lô đã huỷ / đã đi).",
  PACKAGE_OTHER_CARRIER: "Kiện này đi cùng hãng vận chuyển khác — không xếp lên xe này.",
  PACKAGE_REQUIRES_LOAD_PLAN:
    "Kiện giao nguyên chuyến chỉ xếp lên xe theo kế hoạch xếp xe, không xếp ở chuyến gửi kiện.",
  LOAD_SCAN_ID_CONFLICT:
    "Lần quét này đã dùng cho kiện hoặc chuyến khác — quét lại để tạo lần quét mới.",
  // 409 — lô trong chuyến
  SHIPMENT_NOT_FOR_LOAD: "Lô này không đi trên chuyến này (kho khác, hoặc cách giao khác).",
  SHIPMENT_OTHER_CARRIER: "Lô này đã gán cho hãng vận chuyển khác.",
  SHIPMENT_ON_ANOTHER_LOAD: "Lô này đang nằm trên chuyến xe khác — bỏ khỏi chuyến đó trước.",
  SHIPMENT_STATE_CONFLICT: "Lô giao không làm được thao tác này ở trạng thái hiện tại.",
  CARRIER_INACTIVE: "Hãng này đã ngừng sử dụng — chọn hãng khác.",
  // 409 — chuyến
  INVALID_LOAD_TRANSITION: "Trạng thái chuyến đã đổi ở nơi khác — thao tác chưa được thực hiện.",
  LOAD_NOT_FULLY_LOADED:
    "Còn kiện trong biên bản chưa quét lên xe — quét đủ (kể cả mọi kiện của một bộ) hoặc bỏ lô đó khỏi chuyến gửi kiện.",
  // BE PR #162 (chuyến nguyên xe)
  LOAD_UNLOAD_PENDING: "Xe còn kiện của đơn đã huỷ — dỡ các kiện đó xuống trước khi bàn giao.",
  LOAD_MANAGED_BY_PLAN:
    "Chuyến này thuộc kế hoạch xếp xe — thêm / bỏ lô hay huỷ chuyến phải đi qua kế hoạch.",
  INVALID_LOAD_PLAN_TRANSITION:
    "Kế hoạch xếp xe chưa ở trạng thái Đã chốt — đặt xe, bắt đầu xếp hàng và bàn giao chỉ làm được khi kế hoạch đã chốt.",
  ORDER_NOT_CANCELLABLE:
    "Đơn của lô này không còn huỷ được (hàng đã đóng gói hoặc đã có xe rời kho) — xử lý qua luồng trả hàng.",
  LOAD_EMPTY: "Chuyến chưa có lô giao nào — thêm lô trước khi bàn giao.",
  OPTIMISTIC_LOCK: "Chuyến vừa được cập nhật ở nơi khác — đã tải lại, kiểm tra rồi thử lại.",
  LOCK_TIMEOUT: "Hệ thống đang bận xử lý chuyến này — thử lại sau vài giây.",
  CONFLICT: "Yêu cầu này đã được dùng để mở một chuyến khác — thử lại.",
  // 409 — chặn bàn giao theo lô (BE nêu tên lô)
  LABEL_OUTDATED:
    "Nhãn kiện đã cũ (thu hộ khác số đơn cần thu, hoặc kiện đã chuyển sang lô khác) — in lại nhãn rồi quét / ký bàn giao lại.",
  ORDER_BALANCE_NOT_PAID: "Đơn của lô này chưa thanh toán đủ trước khi giao — chưa bàn giao được.",
  ORDER_INVALID_TRANSITION: "Đơn của lô này đang tạm giữ hoặc không ở trạng thái cho bàn giao.",
  // BE PR #150: lô sẽ tách đơn ra nhiều lần giao mà Sales chưa cho phép giao một phần (thêm lô vào chuyến,
  // mở chuyến với lô, bàn giao)
  ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED:
    "Đơn của lô này chưa được phép giao một phần — nhờ Sale bật “Cho phép giao một phần” trên đơn, hoặc đưa các lô còn lại của đơn đi cùng chuyến.",
  // BE PR #164 (xe của kế hoạch nguồn TRANSFER): bàn giao xe cuối chuyển hàng giữ của lệnh sang đang vận chuyển
  TRANSFER_NOT_PACKED:
    "Lệnh chuyển kho trên xe không còn ở trạng thái đã đóng gói / đang lấy hàng (đã dừng lấy hàng hoặc đã đổi) — tải lại; muốn đi tiếp phải đóng gói và lập kế hoạch xe lại.",
  RESERVATION_NOT_ACTIVE:
    "Phần hàng đã giữ cho lệnh chuyển kho không còn hiệu lực (đã nhả hoặc hết hạn) nên chưa bàn giao được — nhờ quản lý kho kiểm tra tồn nguồn.",
  STOCK_CARTON_NOT_SHIPPABLE:
    "Thùng giao nguyên của lệnh chuyển kho không còn khớp hàng đang giữ (thùng đã mở hoặc đổi) — nhờ quản lý kho kiểm tra tồn nguồn.",
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
  carrierRepresentativeRequired: "Nhập tên người ký bên hãng",
  vehiclePlateRequired: "Nhập biển số xe",
  signedRequired: "Xác nhận hai bên đã ký biên bản",
  reasonRequired: "Chọn lý do",
  noteRequiredForOther: "Lý do khác phải ghi chú rõ",
  cancelReasonRequired: "Nhập lý do huỷ chuyến",
} as const;
