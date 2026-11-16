/**
 * Nhãn của mã vận đơn theo chuyến, đặt xe qua API hãng, cảnh báo / chặn bàn giao và danh mục hãng
 * (docs 09 §4.1, §4.2 bước 6–8, §4.4, BR-18, BR-23–25, BR-29; docs 17 BR-28 / BR-29; BE `LoadWaybillController`,
 * `WaybillImportController`, `CarrierController`, `DispatchController`).
 */

import { SHIPPING_LIMITS } from "./numbers";

export const SHIPPING_WAYBILL_LABELS = {
  /* ── Thẻ mã vận đơn trên chuyến ─────────────────────────────────── */
  card: {
    title: "Mã vận đơn",
    number: "Mã vận đơn của hãng",
    missing: "Chưa có mã vận đơn — bắt buộc phải có trước khi ký bàn giao.",
    missingHint:
      "Hãng báo mã qua webhook, hoặc nhập tay ở đây, hoặc nhập hàng loạt từ file. Mã vận đơn không trùng giữa các chuyến của cùng một hãng.",
    notBooked: "Đặt xe với hãng trước, rồi mới nhập được mã vận đơn.",
    apiManaged:
      "Hãng này đặt xe qua API: mã vận đơn là mã đơn hãng trả về khi tạo đơn — không nhập tay. Muốn đổi thì huỷ đặt xe và đặt lại.",
    record: "Nhập mã vận đơn",
    edit: "Sửa mã vận đơn",
    correct: "Sửa mã vận đơn (sau khi rời kho)",
    importLink: "Nhập từ file",
    history: "Lịch sử mã vận đơn",
    historyEmpty: "Chưa có thay đổi nào.",
    historyLoadFailed: "Không tải được lịch sử mã vận đơn.",
    historyWhen: "Thời điểm",
    historyOld: "Mã cũ",
    historyNew: "Mã mới",
    historySource: "Nguồn",
    historyWho: "Người đổi",
    historyReason: "Lý do",
    historyRemoved: "đã xoá cùng đặt xe",
    historyCarrier: "Hãng báo",
    source: {
      MANUAL: "Nhập tay",
      FILE: "Nhập từ file",
      WEBHOOK: "Hãng báo (webhook)",
      API: "API đặt xe",
      UNKNOWN: "Không rõ",
    },
  },
  dialog: {
    title: "Nhập mã vận đơn",
    correctionTitle: "Sửa mã vận đơn sau khi rời kho",
    description:
      "Mã vận đơn do hãng cấp cho chuyến này. Biển số, tài xế nhập kèm nếu đã biết; để trống thì giữ nguyên.",
    correctionDescription:
      "Chuyến đã rời kho: chỉ đổi được mã vận đơn (biển số và tài xế đã nằm trên biên bản hai bên ký), bắt buộc nêu lý do, mọi lần sửa được lưu lịch sử.",
    waybillNo: "Mã vận đơn",
    waybillNoHint: `1–${SHIPPING_LIMITS.waybillNoMax} ký tự, không có khoảng trắng.`,
    reason: "Lý do sửa",
    submit: "Lưu mã vận đơn",
    correctionSubmit: "Lưu thay đổi",
  },
  /* ── Nhập hàng loạt từ file (BE WaybillImportController) ─────────── */
  import: {
    title: "Nhập mã vận đơn từ file",
    description:
      "Điền mã vận đơn (kèm biển số, tài xế nếu có) cho nhiều chuyến một lần theo file mẫu của hệ thống. Hệ thống kiểm từng dòng trước; chỉ các dòng hợp lệ được áp dụng.",
    back: "Danh sách chuyến xe",
    template: "Tải file mẫu",
    templateFileName: "waybill-import-template.csv",
    templateFailed: "Không tải được file mẫu — thử lại sau.",
    fileLabel: "Chọn file (CSV theo file mẫu)",
    fileHint: `Tối đa ${SHIPPING_LIMITS.waybillImportMaxRows} dòng dữ liệu, dung lượng không quá 1 MB. Cột theo thứ tự: mã chuyến, mã vận đơn, biển số, tên tài xế, điện thoại tài xế.`,
    fileTooLarge: "File quá lớn (tối đa 1 MB).",
    preview: "Xem trước",
    previewing: "Đang kiểm file…",
    previewTitle: "Kết quả kiểm file",
    summary: (total: number, ok: number, bad: number) => `${total} dòng: ${ok} hợp lệ, ${bad} lỗi`,
    line: "Dòng",
    loadCode: "Mã chuyến",
    waybillNo: "Mã vận đơn",
    plate: "Biển số",
    driver: "Tài xế",
    outcomeHeader: "Kết quả",
    overwriteHeader: "Ghi đè",
    overwriteConfirm: "Ghi đè",
    overwriteHint:
      "Chuyến đã có mã vận đơn khác: tick “Ghi đè” ở các dòng bạn xác nhận thay mã cũ, dòng không tick sẽ không được áp dụng.",
    outcome: {
      NEW: "Mới",
      OVERWRITE: "Sẽ ghi đè mã cũ",
      SAME: "Không đổi",
      ERROR: "Lỗi",
      UNKNOWN: "Không rõ",
    },
    problem: {
      MISSING_FIELDS: "Thiếu mã chuyến hoặc mã vận đơn.",
      INVALID_WAYBILL: "Mã vận đơn không hợp lệ (1–64 ký tự, không khoảng trắng).",
      INVALID_VEHICLE_DETAILS: "Biển số hoặc thông tin tài xế không hợp lệ.",
      LOAD_NOT_FOUND: "Không có chuyến nào mang mã này.",
      LOAD_OUT_OF_SCOPE: "Chuyến thuộc kho bạn không phụ trách.",
      LOAD_REPEATED: "Mã chuyến này đã có ở dòng khác trong file.",
      LOAD_NOT_BOOKED: "Chuyến chưa ghi nhận đặt xe (chưa có hãng).",
      LOAD_CANCELLED: "Chuyến đã huỷ.",
      LOAD_LEFT: "Chuyến đã rời kho — sửa mã trên màn chuyến (quản lý kho, kèm lý do).",
      WAYBILL_FROM_CARRIER_API: "Hãng đặt xe qua API: mã vận đơn do hãng cấp, không nhập từ file.",
      DUPLICATE_IN_FILE: "Mã vận đơn này đã có ở dòng khác trong file.",
      DUPLICATE_IN_CARRIER: "Mã vận đơn này đã dùng cho chuyến khác của cùng hãng",
      OVERWRITE_NOT_CONFIRMED: "Chuyến đã có mã khác — chưa được xác nhận ghi đè.",
      UNKNOWN: "Dòng không áp dụng được.",
    },
    heldBy: "chuyến",
    apply: "Nhập các dòng hợp lệ",
    applying: "Đang nhập…",
    resultTitle: "Đã nhập file",
    resultSummary: (applied: number, rejected: number) =>
      `${applied} dòng đã áp dụng, ${rejected} dòng không áp dụng`,
    resultHint:
      "File đã được lưu làm file vận đơn của các chuyến được áp dụng. Dòng lỗi giữ lại ở bảng dưới kèm lý do — sửa file rồi nhập lại.",
    another: "Nhập file khác",
    noApplicable: "Không có dòng nào áp dụng được — sửa file rồi chọn lại.",
    noPermission: "Bạn chưa được cấp quyền nhập mã vận đơn từ file.",
  },
  /* ── Cảnh báo khi bắt đầu xếp + chặn khi ký (09 §4.2 bước 7–8, BR-04, BR-18) ── */
  warnings: {
    title: "Có đơn trên xe chưa được phép đi",
    description:
      "Vẫn xếp hàng được, nhưng ký bàn giao sẽ bị từ chối cả xe cho tới khi từng đơn dưới đây được xử lý — hoặc dỡ kiện của đơn đó (huỷ có kiểm soát xe này).",
    dismiss: "Ẩn",
  },
  blocked: {
    title: "Cả xe bị từ chối bàn giao — có đơn chưa được phép đi",
    description:
      "Bàn giao là tất cả hoặc không. Xử lý từng đơn dưới đây rồi ký lại, hoặc dỡ kiện của đơn đó bằng huỷ có kiểm soát xe này.",
    order: "Đơn",
    reason: "Lý do",
    unpaid: (amount: string) => `Còn ${amount} đợt thanh toán trước khi giao chưa thu.`,
    unpaidBatch: (amount: string, seq: number) =>
      `Còn ${amount} đợt thanh toán trước khi giao chưa thu (đợt giao ${seq}).`,
    windowNotOpen: (date: string) =>
      `Chưa tới ngày bắt đầu cửa sổ giao — chỉ bàn giao được từ ${date}. Khách nhận sớm thì nhờ Sale dời cửa sổ giao.`,
    windowNotOpenBatch: (date: string, seq: number) =>
      `Đợt giao ${seq} chưa tới ngày bắt đầu cửa sổ giao — chỉ bàn giao được từ ${date}. Khách nhận sớm thì nhờ Sale dời cửa sổ giao.`,
    onHold: "Đơn đang tạm giữ hoặc không ở trạng thái cho bàn giao.",
    cancelled: "Đơn đã huỷ.",
    other: "Đơn không được phép bàn giao lúc này.",
    batch: "đợt giao",
  },
  missingWaybill: {
    title: "Chuyến chưa có mã vận đơn",
    description: "Cần mã vận đơn của hãng trước khi hai bên ký bàn giao.",
    enter: "Nhập mã vận đơn",
    apiManaged:
      "Hãng này đặt xe qua API nên mã vận đơn do hãng cấp — huỷ đặt xe và đặt lại nếu thiếu mã.",
  },
  /* ── Đặt xe qua API hãng (09 BR-29) ──────────────────────────────── */
  apiBooking: {
    description:
      "Hãng này đặt xe qua API: hệ thống tạo đơn ở hãng khi bạn lưu. Nhập giờ hẹn lấy hàng và xác nhận thứ tự các điểm giao; mã vận đơn, biển số và tài xế do hãng trả về.",
    pickupAt: "Giờ hẹn lấy hàng",
    pickupAtHint: "Bỏ trống = lấy hàng càng sớm càng tốt.",
    stops: "Thứ tự điểm giao",
    stopsHint:
      "Điểm lấy hàng là kho xuất; mỗi lô giao trên xe là một điểm giao, theo thứ tự bạn xác nhận (kế hoạch xếp xe chưa sắp theo thứ tự giao).",
    stop: (n: number) => `Điểm ${n}`,
    up: "Lên",
    down: "Xuống",
    upAria: (code: string) => `Đưa điểm giao ${code} lên`,
    downAria: (code: string) => `Đưa điểm giao ${code} xuống`,
    submit: "Tạo đơn ở hãng",
    waitNote: "Hệ thống đang gọi hãng — chờ vài giây, đừng bấm lại.",
    notice: {
      title: "Đơn ở hãng",
      status: {
        REQUESTED: "Đang tạo đơn ở hãng",
        BOOKED: "Đã tạo đơn ở hãng",
        FAILED: "Hãng từ chối đơn",
        CANCELLED: "Đã huỷ ở hãng",
        CANCEL_FAILED: "Hãng không huỷ được đơn — xử lý trực tiếp với hãng",
        UNKNOWN: "Không rõ",
      },
      carrierOrder: "Mã đơn ở hãng",
      tracking: "Theo dõi đơn",
      lastError: "Lỗi gần nhất",
    },
  },
  /* ── Danh mục hãng vận chuyển ────────────────────────────────────── */
  carriers: {
    title: "Hãng vận chuyển",
    subtitle:
      "Danh mục hãng để chọn khi ghi nhận đặt xe. Hãng ngừng dùng không nhận chuyến mới; kiểu kết nối quyết định cách hãng báo mã vận đơn và kết quả giao.",
    searchPlaceholder: "Tìm theo mã hoặc tên hãng",
    searchScope: "Mã, tên hãng",
    statusFilter: "Trạng thái",
    all: "Tất cả",
    clearFilters: "Xoá bộ lọc",
    listCaption: "hãng",
    refetching: "Đang tải lại danh mục hãng",
    create: "Thêm hãng",
    edit: "Sửa",
    editAria: (code: string) => `Sửa hãng ${code}`,
    empty: {
      noDataTitle: "Chưa có hãng vận chuyển",
      noDataDescription: "Thêm hãng đầu tiên để ghi nhận đặt xe cho các chuyến.",
      noDataDescriptionReadOnly: "Quản lý kho sẽ thêm hãng vận chuyển vào danh mục.",
      noResultsDescription: "Không có hãng nào khớp từ khoá hoặc bộ lọc hiện tại.",
    },
    column: {
      code: "Mã hãng",
      name: "Tên hãng",
      contact: "Liên hệ",
      connection: "Kiểu kết nối",
      status: "Trạng thái",
      actions: "Thao tác",
    },
    status: { ACTIVE: "Đang dùng", INACTIVE: "Ngừng dùng", UNKNOWN: "Không rõ" },
    connectionType: {
      MANUAL: "Không có webhook",
      WEBHOOK_LOAD: "Webhook theo chuyến",
      API_BOOKING: "Tích hợp API đặt xe",
      UNKNOWN: "Không rõ",
    },
    connectionHint: {
      MANUAL:
        "Đặt xe và nhập mã vận đơn ngoài hệ thống; Quản lý kho ghi tay kết quả giao khi hãng báo lại.",
      WEBHOOK_LOAD:
        "Hãng đẩy mã vận đơn, biển số, tài xế và kết quả giao về hệ thống qua webhook kèm mã chuyến, ký bằng khoá bí mật.",
      API_BOOKING:
        "Hệ thống tạo / huỷ đơn ở hãng. Cấu hình kết nối (khoá API, điểm lấy hàng, mã dịch vụ theo loại xe) chưa chỉnh được ở màn này.",
    },
    form: {
      createTitle: "Thêm hãng vận chuyển",
      editTitle: "Sửa hãng vận chuyển",
      description: "Hãng ngừng dùng không nhận chuyến mới; chuyến đã đặt vẫn giữ nguyên.",
      code: "Mã hãng",
      codeHint: `${SHIPPING_LIMITS.carrierCodeMin}–${SHIPPING_LIMITS.carrierCodeMax} ký tự: chữ, số, “-” hoặc “_”; chữ thường được đổi thành chữ hoa.`,
      name: "Tên hãng",
      contactName: "Người liên hệ",
      contactPhone: "Điện thoại liên hệ",
      status: "Trạng thái",
      connectionType: "Kiểu kết nối",
      webhookSecret: "Khoá bí mật webhook",
      webhookSecretNew: `Bắt buộc với webhook theo chuyến (${SHIPPING_LIMITS.webhookSecretMin}–${SHIPPING_LIMITS.webhookSecretMax} ký tự, không có khoảng trắng đầu / cuối). Khoá không hiển thị lại sau khi lưu.`,
      webhookSecretSaved:
        "Đã lưu khoá — để trống để giữ khoá hiện tại, hoặc nhập khoá mới để thay.",
      apiBookingLocked:
        "Hãng tích hợp API đặt xe: kiểu kết nối và cấu hình API giữ nguyên, chỉ sửa được thông tin chung.",
      create: "Thêm hãng",
      save: "Lưu thay đổi",
      stale: "Hãng vừa được cập nhật ở nơi khác — đã tải lại danh mục, kiểm tra rồi lưu lại.",
    },
  },
} as const;

export const SHIPPING_WAYBILL_TOAST_MESSAGES = {
  waybillRecorded: "Đã lưu mã vận đơn",
  waybillCorrected: "Đã sửa mã vận đơn",
  waybillImported: "Đã nhập mã vận đơn từ file",
  carrierCreated: "Đã thêm hãng vận chuyển",
  carrierUpdated: "Đã lưu hãng vận chuyển",
} as const;
