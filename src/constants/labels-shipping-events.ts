/**
 * Nhãn của màn "Sự kiện hãng vận chuyển" — nhật ký sự kiện webhook và danh sách lỗi (docs 09 §3 Output, §4.3 bước 5,
 * §4.5 bước 2–8; open-questions E15, E17, E21, E22, E25; BE `CarrierEventController`).
 * Ghi chú tự do của BE (`resultNote`: tiếng Anh, kèm mã chuyến / số liệu khác nhau từng lần) KHÔNG hiện ra — màn chỉ hiện
 * nghĩa tiếng Việt của kết quả.
 * Nghĩa từng kết quả lấy từ BE `CarrierEventResult`, từng loại sự kiện từ `CarrierEventKind` và bảng ánh xạ ở docs 09 §4.5.
 */

import { CARRIER_EVENT_NOTE_MAX } from "./carrier-events";

export const SHIPPING_EVENT_LABELS = {
  title: "Sự kiện hãng vận chuyển",
  subtitle:
    "Mọi sự kiện hãng gửi về qua webhook và kết quả giao nhập từ file. Sự kiện lỗi không bao giờ tự áp lại: xử lý tay rồi đánh dấu đã xử lý.",
  listCaption: "sự kiện",
  refetching: "Đang tải lại danh sách sự kiện",
  openRow: "Xem sự kiện",
  noRead: "Bạn chưa được cấp quyền xem sự kiện hãng vận chuyển. Liên hệ quản trị để được cấp.",
  filter: {
    result: "Kết quả",
    errors: "Danh sách lỗi",
    all: "Tất cả sự kiện",
    carrier: "Hãng",
    allCarriers: "Tất cả hãng",
    carrierOther: "Hãng đã chọn",
    handling: "Xử lý",
    handlingAll: "Tất cả",
    handlingOpen: "Chưa xử lý",
    handlingDone: "Đã xử lý",
    handlingHint: "Chỉ lọc được trong danh sách lỗi",
    load: "Chuyến xe",
    loadValue: "Một chuyến xe",
    carrierValue: "Một hãng",
    clearLoad: "Bỏ lọc chuyến",
    clearCarrier: "Bỏ lọc hãng",
    clearResult: "Về danh sách lỗi",
    clearHandling: "Bỏ lọc xử lý",
    resetAll: "Đặt lại",
  },
  empty: {
    noErrorsTitle: "Không có sự kiện lỗi",
    noErrorsDescription:
      "Chưa có sự kiện nào chữ ký sai, không ghép được chuyến hay cần xem xét. Sự kiện như vậy sẽ hiện ở đây.",
    seeAll: "Xem tất cả sự kiện",
    noDataTitle: "Chưa có sự kiện nào",
    noDataDescription:
      "Sự kiện hãng gửi về qua webhook và kết quả giao nhập từ file sẽ hiện ở đây.",
    noResultsDescription: "Không có sự kiện nào khớp bộ lọc hiện tại.",
  },
  column: {
    received: "Nhận lúc",
    reported: (when: string) => `Hãng báo ${when}`,
    carrier: "Hãng",
    kind: "Loại sự kiện",
    loadShipment: "Chuyến xe / lô giao",
    result: "Kết quả",
    resolution: "Xử lý",
  },
  source: {
    WEBHOOK: "Webhook của hãng",
    FILE: "File nhập kết quả giao",
    UNKNOWN: "Không rõ",
  },
  result: {
    RECEIVED: "Đang xử lý",
    APPLIED: "Đã áp dụng",
    DUPLICATE: "Trùng",
    STALE: "Cũ hơn (bỏ qua)",
    IGNORED: "Không có gì để áp dụng",
    UNMATCHED: "Không ghép được chuyến",
    INVALID_SIGNATURE: "Xác thực sai",
    NEEDS_REVIEW: "Cần xem xét",
    UNVERIFIED: "Chưa xác minh được",
    UNKNOWN: "Không rõ",
  },
  resultMeaning: {
    RECEIVED:
      "Hệ thống đã nhận sự kiện nhưng chưa xử lý xong. Nếu để lâu mà vẫn thế này thì việc xử lý có thể đã bị gián đoạn.",
    APPLIED: "Sự kiện đã làm thay đổi chuyến hoặc lô giao, hoặc đã ghi một mốc hành trình.",
    DUPLICATE: "Hãng gửi lại đúng báo cáo đã có: chỉ ghi một lần.",
    STALE:
      "Sự kiện cũ hơn báo cáo đã áp dụng gần nhất cho chuyến hoặc lô giao đó nên bị bỏ qua, vẫn được lưu nhật ký.",
    IGNORED: "Sự kiện không có thông tin nào mà hệ thống cần áp dụng.",
    UNMATCHED:
      "Không có chuyến nào của hãng này khớp với sự kiện: mã không tồn tại, chuyến của hãng khác hoặc chuyến đã huỷ. Sự kiện không được áp dụng.",
    INVALID_SIGNATURE:
      "Chữ ký hoặc thông tin xác thực của sự kiện không đúng, hoặc hãng không nhận webhook. Sự kiện không được áp dụng.",
    NEEDS_REVIEW:
      "Sự kiện không hợp lệ với trạng thái hiện tại của chuyến hoặc lô giao (ví dụ báo giao thành công khi chuyến chưa rời kho, hoặc sau khi Quản lý kho đã sửa tay kết quả giao). Sự kiện không được áp dụng.",
    UNVERIFIED:
      "Hãng báo kết quả cuối nhưng khi hệ thống hỏi lại hãng thì chưa được xác nhận. Sự kiện không được áp dụng.",
    UNKNOWN: "Kết quả mới mà màn hình chưa nhận biết.",
  },
  kind: {
    WAYBILL: "Mã vận đơn, biển số, tài xế",
    DRIVER_ASSIGNED: "Tài xế nhận đơn",
    DRIVER_RELEASED: "Tài xế huỷ, đơn tìm tài xế khác",
    PICKED_UP: "Đã lấy hàng",
    IN_TRANSIT: "Đang giao",
    DELIVERED: "Giao thành công",
    DELIVERY_FAILED: "Giao thất bại",
    RETURNING: "Đang hoàn hàng",
    RETURNED: "Đã hoàn hàng",
    ORDER_CANCELLED: "Hãng huỷ đơn",
    CANCELLED_ON_REQUEST: "Huỷ đơn theo yêu cầu của hệ thống",
    ORDER_COMPLETED: "Hãng hoàn tất đơn",
    OTHER: "Trạng thái khác",
    UNKNOWN: "Không rõ",
  },
  detail: {
    title: "Sự kiện hãng vận chuyển",
    description: (carrier: string, when: string) => `${carrier} · nhận lúc ${when}`,
    carrier: "Hãng",
    source: "Nguồn",
    received: "Nhận lúc",
    reported: "Hãng báo lúc",
    kind: "Loại sự kiện",
    reference: "Mã hãng nêu",
    referenceHint: "Mã chuyến nội bộ hoặc mã đơn ở hãng mà sự kiện nêu.",
    load: "Chuyến xe",
    shipment: "Lô giao",
    signature: "Xác thực",
    signatureOk: "Hợp lệ",
    signatureBad: "Không hợp lệ",
    result: "Kết quả xử lý",
    payload: "Nội dung hãng gửi",
    payloadHint: "Chỉ xem. Thông tin xác thực trong nội dung (nếu có) đã được hệ thống ẩn.",
    payloadEmpty: "Không có nội dung.",
    openLoad: "Mở chuyến xe",
    openShipment: "Mở lô giao",
    loading: "Đang tải chi tiết sự kiện…",
    loadFailed: "Không tải được chi tiết sự kiện. Đóng hộp thoại này rồi mở lại để thử lại.",
    close: "Đóng",
    none: "—",
  },
  guide: {
    title: "Cách xử lý",
    text: "Hệ thống không tự áp lại sự kiện này. Ghi tay hoặc sửa tay kết quả giao trên lô giao, hoặc nhập mã vận đơn trên chuyến xe, rồi đánh dấu đã xử lý kèm ghi chú.",
  },
  resolved: {
    title: "Đã xử lý",
    by: "Người xử lý",
    at: "Lúc",
    note: "Ghi chú xử lý",
    never: "Sự kiện này đã đánh dấu xong, hệ thống sẽ không áp lại.",
  },
  resolve: {
    note: "Ghi chú xử lý",
    noteHint: `Ghi rõ đã xử lý thế nào, tối đa ${CARRIER_EVENT_NOTE_MAX} ký tự. Sau khi đánh dấu, sự kiện không bao giờ được áp lại.`,
    submit: "Đánh dấu đã xử lý",
    noteRequired: "Nhập ghi chú xử lý",
    noteTooLong: `Ghi chú tối đa ${CARRIER_EVENT_NOTE_MAX} ký tự`,
  },
} as const;

export const SHIPPING_EVENT_TOAST_MESSAGES = {
  carrierEventResolved: "Đã đánh dấu sự kiện là đã xử lý",
} as const;

/** errorCode BE của `CarrierEventController` → câu tiếng Việt (mã khác dùng bảng chung của giao hàng). */
export const SHIPPING_EVENT_ERROR_MESSAGES = {
  CARRIER_EVENT_NOT_FOUND: "Không tìm thấy sự kiện này.",
  CARRIER_EVENT_NOT_RESOLVABLE:
    "Không đánh dấu đã xử lý được: sự kiện không thuộc danh sách lỗi, đã được đánh dấu rồi, hoặc hệ thống vẫn đang xử lý nó.",
  OUT_OF_DATA_SCOPE: "Bạn không phụ trách kho của sự kiện này.",
  VALIDATION_FAILED: SHIPPING_EVENT_LABELS.resolve.noteRequired,
} as const;
