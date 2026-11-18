/**
 * Sự kiện hãng vận chuyển — nhật ký webhook và danh sách lỗi (docs 09 §3 Output, §4.5; BE `CarrierEventController`,
 * `CarrierEventResult`, `CarrierEventKind`). Giá trị nguyên văn theo enum của BE.
 */

/** `CarrierEventResult` — kết quả xử lý một sự kiện (quyết một lần). */
export const CARRIER_EVENT_RESULTS = [
  "RECEIVED",
  "APPLIED",
  "DUPLICATE",
  "STALE",
  "IGNORED",
  "UNMATCHED",
  "INVALID_SIGNATURE",
  "NEEDS_REVIEW",
  "UNVERIFIED",
] as const;
export type CarrierEventResultCode = (typeof CARRIER_EVENT_RESULTS)[number];

/**
 * Kết quả thuộc danh sách lỗi (BE `CarrierEventResult.errorList()`, docs 09 §4.5 bước 8): không bao giờ tự áp lại,
 * Quản lý kho xử lý tay rồi đánh dấu đã xử lý.
 */
export const CARRIER_EVENT_ERROR_RESULTS = [
  "RECEIVED",
  "UNMATCHED",
  "INVALID_SIGNATURE",
  "NEEDS_REVIEW",
  "UNVERIFIED",
] as const satisfies readonly CarrierEventResultCode[];

/** Giá trị `result=` BE nhận cho "cả danh sách lỗi". */
export const CARRIER_EVENT_ERRORS_FILTER = "ERRORS";

/** `CarrierEventKind` — hãng báo điều gì, theo ngôn ngữ của hệ thống (docs 09 §4.5 bước 7). */
export const CARRIER_EVENT_KINDS = [
  "WAYBILL",
  "DRIVER_ASSIGNED",
  "DRIVER_RELEASED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNING",
  "RETURNED",
  "ORDER_CANCELLED",
  "CANCELLED_ON_REQUEST",
  "ORDER_COMPLETED",
  "OTHER",
] as const;

/** `CarrierEvents.EventRow.source` — hãng gọi webhook, hoặc một dòng của file nhập kết quả giao. */
export const CARRIER_EVENT_SOURCES = ["WEBHOOK", "FILE"] as const;

/** Cột bảng sự kiện hãng vận chuyển (BE `CarrierEvents.EventRow`). */
export const CARRIER_EVENT_COLUMNS = {
  ACTIONS: "actions",
  CARRIER: "carrier",
  KIND: "kind",
  LOAD: "load",
  RECEIVED: "received",
  RESOLUTION: "resolution",
  RESULT: "result",
} as const;

/** Ghi chú xử lý: bắt buộc, tối đa 1000 ký tự (BE `CarrierEventResolutionRequest`). */
export const CARRIER_EVENT_NOTE_MAX = 1000;

/** Số dòng một trang bảng sự kiện (BE `size` mặc định 20). */
export const CARRIER_EVENT_PAGE_SIZE = 20;

/**
 * Khoá trạng thái dùng cho `status-map` khi hiện kết quả sự kiện: giống tên enum BE, riêng `RECEIVED` đổi thành
 * `EVENT_RECEIVED` vì `RECEIVED` đã là trạng thái phản hồi của NCC (nhãn và màu khác).
 */
export const CARRIER_EVENT_STATUS_KEYS = { RECEIVED: "EVENT_RECEIVED" } as const;
