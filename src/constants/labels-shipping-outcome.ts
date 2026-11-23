/**
 * Nhãn hộp thoại ghi nhận / sửa tay kết quả giao (docs 09 §4.3 bước 2, 3, 5): bảng tóm tắt lô, thời điểm giao, sửa kết
 * quả với lý do bắt buộc. Tách file riêng để `labels-shipping.ts` chỉ nối thêm.
 */

import { SHIPPING_LIMITS } from "./numbers";

/** Thêm vào `shipment.outcomeDialog`. */
export const SHIPPING_OUTCOME_DIALOG_EXTRA = {
  summary: {
    currentResult: "Kết quả hiện tại",
    order: "Đơn hàng",
    carrier: "Hãng vận chuyển",
    load: "Chuyến",
    packages: "Số kiện",
    failureReason: "Lý do giao thất bại",
  },
  /** Mô tả số kiện: "4 kiện · 34,4 kg"; thiếu cân nặng thì chỉ nêu số kiện. */
  packagesCount: (count: number) => `${count} kiện`,
  audit: "Hệ thống lưu người ghi nhận và thời điểm ghi nhận.",
  deliveredAt: "Thời điểm giao",
  deliveredAtHint:
    "Giờ hãng báo đã giao (giờ Việt Nam); để nguyên là lúc ghi nhận. Đây là ngày giao của đơn: ngày lập hoá đơn nháp của lô và mốc tính hạn các đợt thanh toán sau giao.",
  reasonGroup: "Lý do",
} as const;

export const SHIPPING_CORRECTION_LABELS = {
  action: "Sửa kết quả giao",
  title: "Sửa kết quả giao",
  description:
    "Dùng khi hãng báo sai kết quả. Hệ thống ghi lại người sửa, thời điểm, kết quả cũ và mới. Sau khi sửa, báo cáo tiếp theo của hãng về lô này không tự áp dụng mà chờ Quản lý kho xem lại.",
  current: "Kết quả hiện tại",
  to: "Sửa thành",
  toDelivered: "Đã giao",
  toFailed: "Giao thất bại",
  reason: "Lý do sửa",
  reasonHint: `Bắt buộc, tối đa ${SHIPPING_LIMITS.cancelReasonMax} ký tự. Nêu vì sao báo cáo của hãng sai.`,
  reasonRequired: "Nhập lý do sửa",
  reasonPlaceholder: "Ví dụ: khách xác nhận đã nhận hàng lúc 10 giờ",
  invoiceNote:
    "Hoá đơn nháp của lô sẽ bị huỷ; nếu hoá đơn đã phát hành, hệ thống tạo nháp điều chỉnh giảm toàn bộ cho Kế toán.",
  submit: "Lưu thay đổi",
} as const;

/** Thêm vào `SHIPPING_ERROR_MESSAGES`. */
export const SHIPPING_OUTCOME_ERROR_MESSAGES = {
  SHIPMENT_DELIVERY_TIME_IN_FUTURE: "Thời điểm giao không được ở tương lai.",
  SHIPMENT_DELIVERY_TIME_BEFORE_HANDOVER:
    "Thời điểm giao không được trước lúc bàn giao lô cho hãng.",
  ORDER_DELIVERY_NOT_CORRECTABLE:
    "Không sửa được kết quả giao này nữa: đơn đã hoàn tất hoặc đã sang bước xử lý khác.",
  // WF-05 G1 (Q-12): lô đã được Sale đóng như thất lạc — phần hàng đã rời đơn và đã tính tiền, không ghi kết quả giao nữa
  ORDER_SHIPMENT_INVALID_TRANSITION:
    "Lô này không ghi kết quả được nữa: Sale đã đóng phần thất lạc của lô (hàng đã rời đơn và đã tính tiền), hoặc lô đã sang bước khác. Tải lại trang để xem trạng thái mới.",
} as const;

/** Lỗi ô thời điểm giao trong form. */
export const SHIPPING_DELIVERY_TIME_MESSAGES = {
  future: "Thời điểm giao không được ở tương lai.",
  beforeHandover: "Thời điểm giao không được trước lúc bàn giao lô cho hãng.",
  invalid: "Nhập đủ ngày và giờ.",
} as const;
