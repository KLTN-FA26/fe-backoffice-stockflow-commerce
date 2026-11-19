/**
 * Sản xuất theo đơn bán (kltn-docs 17 §4.3, §4.12, §5.3): đơn vị sản xuất, Đơn sản xuất, vòng mẫu in, lịch sản xuất,
 * cảnh báo trễ. Giá trị enum chép nguyên văn từ BE `order/internal/domain/*` (Producer, ProductionOrderStatus,
 * ReprintReason, SampleRound.Result, DelayAlertType). Trạng thái Đơn sản xuất nằm ở `orders.ts`
 * (`PRODUCTION_ORDER_STATUSES`) vì trang đơn bán dùng trước.
 */

import type { ProductionOrderStatus } from "./orders";

// ---- Enum BE --------------------------------------------------------------------------------------------------------

/** BE `Producer.Channel`: EMAIL = hệ thống gửi mail, PDF = Điều phối sản xuất tự giao phiếu (docs 17 §4.3). */
export const PRODUCER_CHANNELS = ["EMAIL", "PDF"] as const;
export type ProducerChannel = (typeof PRODUCER_CHANNELS)[number];

/** BE `Producer.Status`: INACTIVE = không nhận Đơn sản xuất mới (409 PRODUCER_INACTIVE). */
export const PRODUCER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ProducerStatus = (typeof PRODUCER_STATUSES)[number];

/** BE `ReprintReason` (docs 17 §4.3 bước 9, BR-24): PRINT_DEFECT không tính vào số lần in mẫu miễn phí. */
export const REPRINT_REASONS = ["PRINT_DEFECT", "CUSTOMER_CHANGE"] as const;
export type ReprintReason = (typeof REPRINT_REASONS)[number];

/** BE `SampleRound.Result` — vắng mặt khi vòng còn chờ khách. */
export const SAMPLE_ROUND_RESULTS = ["APPROVED", "REPRINT_REQUESTED"] as const;
export type SampleRoundResult = (typeof SAMPLE_ROUND_RESULTS)[number];

/** BE `DelayAlertType` (docs 17 §4.12 bước 48, BR-30). Hai loại về Đơn sản xuất, hai loại về đợt giao. */
export const DELAY_ALERT_TYPES = [
  "AT_RISK",
  "PRODUCTION_LATE",
  "PO_NEEDED",
  "DELIVERY_LATE",
] as const;
export type DelayAlertType = (typeof DELAY_ALERT_TYPES)[number];

/** Chiều sắp xếp danh sách Đơn sản xuất BE nhận (`ProductionOrderSearch`). */
export const PRODUCTION_ORDER_SORTS = ["createdAt", "needByDate", "code", "status"] as const;

/** Trạng thái Đơn sản xuất còn mở — lịch sản xuất chỉ liệt kê nhóm này (docs 17 §4.12 bước 47). */
export const OPEN_PRODUCTION_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SENT",
  "ACCEPTED",
  "SAMPLE_PENDING",
  "IN_PRODUCTION",
  "PARTIALLY_RECEIVED",
] as const satisfies readonly ProductionOrderStatus[];

// ---- Giới hạn (BE `@Size`, `@Min`, `@Max`) -------------------------------------------------------------------------

export const PRODUCTION_LIMITS = {
  /** `ProducerRequest.code`: 2–32 ký tự chữ / số / '-' / '_', bắt đầu bằng chữ hoặc số. */
  producerCodeMin: 2,
  producerCodeMax: 32,
  producerNameMax: 200,
  contactNameMax: 200,
  contactPhoneMax: 32,
  emailMax: 254,
  /** Thời gian sản xuất chuẩn (ngày) — docs 17 §4.3, open-questions B44: mặc định 14, 1–365. */
  leadDaysMin: 1,
  leadDaysMax: 365,
  leadDaysDefault: 14,
  /** Ghi chú, lý do, yêu cầu đóng gói: ≤ 500 ký tự (`ProductionOrder.TEXT_MAX`). */
  textMax: 500,
  /** BE `SampleRounds.MEDIA_PER_UPLOAD_MAX`: tối đa 10 tệp mỗi lần. */
  mediaPerUploadMax: 10,
  /** BE sample upload: ảnh / MP4 / QuickTime / WebM, tối đa 100 MB mỗi tệp. */
  mediaMaxBytes: 100 * 1024 * 1024,
  /** `GET /production-schedule?limit=` mặc định 100, tối đa 200. */
  scheduleLimit: 200,
} as const;

/** Loại tệp vòng mẫu BE nhận (`ProductionSampleService` — ảnh, MP4, QuickTime, WebM). */
export const SAMPLE_MEDIA_ACCEPT = "image/*,video/mp4,video/quicktime,video/webm";
