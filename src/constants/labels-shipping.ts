/**
 * Nhãn, thông báo và lỗi của màn xếp xe & bàn giao hãng (docs 09 §4 bước 4–5, BE SCRUM-288).
 * Hãng vận chuyển là bên thứ ba: không mã vận đơn, không theo dõi hành trình (rescope 2026-10-06).
 */

import { SHIPPING_LIMITS } from "./numbers";

export const SHIPPING_UI_LABELS = {
  pageTitle: "Xếp xe & bàn giao",
  subtitle: "Quét kiện lên xe theo kế hoạch xếp xe, đối soát và bàn giao cho hãng vận chuyển.",
  loadingTitle: "Xếp hàng lên xe",
  manifestTitle: "Biên bản bàn giao",
  loadPlanTitle: "Kế hoạch xếp xe",
  // SCRUM-452
  loadPlanInProgress: "Đang phát triển",
  // Chưa có API BE (SCRUM-288) — màn chỉ chạy trên mock
  notAvailableYet: "Đang phát triển — chờ hệ thống xếp xe & bàn giao hoàn tất.",
  notFoundTitle: "Không tìm thấy chuyến xe",
  notFoundDescription: "Chuyến xe không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với chuyến xe.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa được cấp quyền xem chuyến xe. Liên hệ quản trị để được cấp.",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  refetching: "Đang tải lại danh sách chuyến xe",
  listCaption: "chuyến xe",
  openLoad: "Mở chuyến",
  noTracking:
    "Hãng vận chuyển là bên thứ ba — không có mã vận đơn và không theo dõi hành trình sau khi bàn giao.",
  action: {
    planLoad: "Lập kế hoạch xếp xe",
    startLoading: "Bắt đầu xếp hàng",
    openManifest: "Đối soát & biên bản",
    handover: "Xác nhận bàn giao",
    print: "In biên bản",
  },
  scan: {
    label: "Quét mã kiện",
    placeholder: "Quét hoặc nhập mã kiện rồi nhấn Enter",
    hint: "Ô quét luôn sẵn sàng nhận mã — dùng máy quét mã vạch hoặc gõ tay.",
    accepted: "Đã lên xe",
    notStarted: "Bắt đầu xếp hàng để quét kiện.",
    rejectedTitle: "Mã quét không thành công — chưa lên xe",
    clearRejected: "Xoá danh sách",
    notSent: "Chưa gửi được — quét lại sau.",
    invalidResponse:
      "Máy chủ trả dữ liệu sai định dạng — kiểm tra bảng Đã lên xe trước khi quét lại, báo kỹ thuật.",
  },
  disabledReason: {
    notFullyLoaded: "Còn kiện chưa quét lên xe.",
    emptyLoad: "Chuyến chưa có kiện nào trong kế hoạch — không có gì để bàn giao.",
  },
  noActions: {
    viewOnly: "Bạn chỉ có quyền xem chuyến xe.",
    planned: "Chuyến chưa đặt xe — hoàn tất ở màn Kế hoạch xếp xe.",
    dispatched: "Đã bàn giao cho hãng vận chuyển",
    cancelled: "Chuyến đã huỷ.",
  },
  // ASSUMPTION: docs chưa định nghĩa xử lý kiện thiếu / thừa khi bàn giao (docs 09 §4 bước 4)
  missingHint:
    "Quét đủ các kiện còn thiếu, hoặc gỡ chúng khỏi chuyến trong kế hoạch xếp xe (đang phát triển), rồi mới bàn giao.",
  empty: {
    noDataTitle: "Chưa có chuyến xe",
    noDataDescription: "Chuyến xe được tạo từ kế hoạch xếp xe (đang phát triển).",
    noResultsDescription: "Không có chuyến xe nào khớp từ khoá hoặc bộ lọc hiện tại.",
    allLoaded: "Đã quét đủ kiện theo kế hoạch.",
    noneLoaded: "Chưa quét kiện nào.",
    noLines: "Chuyến chưa có kiện.",
    notLoaded: "Chưa lên xe",
  },
  // Nhãn thông tin chuyến — dùng ở thẻ màn quét và biên bản in
  field: {
    warehouse: "Kho giao",
    load: "Chuyến",
    carrier: "Hãng vận chuyển",
    vehiclePlate: "Biển số xe",
    vehicleType: "Loại xe",
    bookedAt: "Đặt xe lúc",
    handedOverAt: "Thời điểm bàn giao",
    handedOverBlank: "…… giờ …… ngày ……",
    totalLoaded: "Tổng kiện lên xe:",
    totalWeight: "Tổng cân nặng:",
    orderCount: "Số đơn hàng:",
    note: "Ghi chú:",
    weightUnit: "kg",
  },
  document: {
    title: "Biên bản bàn giao hàng cho hãng vận chuyển",
    numberPrefix: "Số:",
    notHandedOver: "(chưa bàn giao)",
    loadPrefix: "Chuyến:",
    draftBanner: "BẢN ĐỐI SOÁT — CHƯA ĐỦ KIỆN, KHÔNG DÙNG ĐỂ KÝ BÀN GIAO",
  },
  caption: {
    missing: "Kiện chưa lên xe của",
    loaded: "Kiện đã lên xe của",
    manifest: "Danh sách kiện bàn giao của",
  },
  info: {
    title: "Thông tin chuyến",
    progress: "Kiện đã lên xe / kế hoạch",
    progressAria: "Kiện đã lên xe",
  },
  table: {
    index: "#",
    packageCode: "Mã kiện",
    order: "Đơn hàng",
    weight: "Cân nặng (kg)",
    loadedAt: "Giờ lên xe",
  },
  searchPlaceholder: "Tìm theo số chuyến hoặc biển số xe",
  loadedSection: "Đã lên xe",
  missingSection: "Chưa lên xe",
  manifest: {
    reconcileTitle: "Đối soát kế hoạch và thực tế",
    warehouseSign: "Đại diện kho",
    carrierSign: "Đại diện hãng vận chuyển",
    signNote: "Ký, ghi rõ họ tên",
    carrierRepresentative: "Tên đại diện hãng vận chuyển",
    note: "Ghi chú bàn giao",
    signedConfirm: "Hai bên đã ký biên bản giấy",
    unavailableTitle: "Chưa có biên bản bàn giao",
    unavailableDescription:
      "Biên bản chỉ có khi chuyến đang xếp hàng (để đối soát) hoặc đã bàn giao.",
    packagesUnit: "kiện",
    missingPrefix: "Thiếu",
    completePrefix: "Đủ",
    completeSuffix: "theo kế hoạch",
    completeHint: "In biên bản, hai bên ký rồi xác nhận bàn giao.",
    signedHint: "Bắt buộc trước khi xác nhận bàn giao.",
    rejectedPending:
      "Có mã quét không thành công ở màn xếp hàng — kiểm tra các kiện này không nằm trên xe trước khi in và bàn giao:",
    printBlocked: "Chỉ in biên bản để ký khi đã quét đủ kiện theo kế hoạch.",
    handoverDescription:
      "Mọi kiện trên chuyến chuyển sang Đã bàn giao; đơn hàng chuyển Đã gửi khi tất cả kiện của đơn đã bàn giao.",
  },
} as const;

export const SHIPPING_TOAST_MESSAGES = {
  loadingStarted: "Đã bắt đầu xếp hàng lên xe",
  handedOver: "Đã bàn giao chuyến cho hãng vận chuyển",
} as const;

/** errorCode đề xuất cho BE SCRUM-288 → câu tiếng Việt. */
export const SHIPPING_ERROR_MESSAGES = {
  PACKAGE_NOT_IN_LOAD: "Kiện không thuộc chuyến này — không được xếp lên xe.",
  PACKAGE_ALREADY_LOADED: "Kiện đã được xếp lên xe của chuyến khác — không xếp lên xe này.",
  PACKAGE_NOT_FOUND: "Không tìm thấy kiện với mã này.",
  // Không khẳng định "đã tải lại": lần tải lại có thể thất bại (khi đó có thông báo riêng)
  INVALID_LOAD_TRANSITION:
    "Trạng thái chuyến đã thay đổi ở nơi khác — thao tác chưa được thực hiện.",
  LOAD_NOT_FULLY_LOADED: "Còn kiện chưa lên xe — chưa bàn giao được.",
  LOAD_NOT_FOUND: "Không tìm thấy chuyến xe.",
  OPTIMISTIC_LOCK: "Chuyến vừa được cập nhật ở nơi khác — thao tác chưa được lưu.",
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho của chuyến này.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  generic: "Không thực hiện được thao tác với chuyến xe. Thử lại sau.",
} as const;

export const SHIPPING_FIELD_MESSAGES = {
  scanRequired: "Nhập mã kiện",
  scanTooLong: `Mã kiện quá dài (tối đa ${SHIPPING_LIMITS.scanCodeMax} ký tự)`,
  scanNotAscii: "Mã có ký tự có dấu / khoảng trắng — tắt bộ gõ tiếng Việt rồi quét lại.",
  tooLong: "Quá dài",
  carrierRepresentativeRequired: "Nhập tên đại diện hãng vận chuyển",
  signedRequired: "Xác nhận hai bên đã ký biên bản",
} as const;
