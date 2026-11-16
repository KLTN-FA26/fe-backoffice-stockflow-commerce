/**
 * Lỗi BE của module hoá đơn điện tử → câu tiếng Việt (BE trả message tiếng Anh; FE chọn câu theo
 * `errorCode`, ErrorCode.java). Không hiện chữ của BE.
 */

import { apiErrorMessage } from "@/lib/api/error-message";

export const EINVOICE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  EINVOICE_NOT_FOUND: "Không tìm thấy hoá đơn điện tử.",
  EINVOICE_INVALID_TRANSITION: "Trạng thái hiện tại của hoá đơn không cho phép thao tác này.",
  EINVOICE_NOT_DRAFT: "Chỉ sửa được hoá đơn nháp. Dữ liệu đã được tải lại.",
  // docs 21 BR-06: tên, mã số thuế, địa chỉ bên mua bắt buộc trước khi phát hành
  EINVOICE_BUYER_PROFILE_INCOMPLETE:
    "Thiếu tên, mã số thuế hoặc địa chỉ bên mua. Nhờ Sale bổ sung hồ sơ khách rồi bấm “Làm mới bên mua”.",
  EINVOICE_NOT_INVOICEABLE: "Lần giao này chưa giao thành công nên chưa lập được hoá đơn.",
  EINVOICE_DELIVERY_TIME_MISSING:
    "Lần giao chưa có thời điểm giao thành công để ghi ngày lập. Nhờ Quản lý kho ghi nhận trước.",
  EINVOICE_SERIES_NOT_CONFIGURED:
    "Chưa cấu hình ký hiệu hoá đơn cho năm của hoá đơn. Nhờ Quản trị hệ thống cấu hình.",
  EINVOICE_OLDER_DRAFT_PENDING:
    "Còn hoá đơn ngày lập sớm hơn chưa phát hành. Phát hành (hoặc huỷ) hoá đơn đó trước.",
  EINVOICE_NOT_ISSUED: "Hoá đơn chưa phát hành nên chưa có tệp XML / PDF.",
  EINVOICE_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp hoá đơn điện tử đang không phản hồi. Hệ thống sẽ tự kiểm tra lại.",
  EINVOICE_PROVIDER_ACCOUNT_INCOMPLETE:
    "Chưa lưu tài khoản nhà cung cấp hoá đơn điện tử. Nhờ Quản trị hệ thống cấu hình.",
  // docs 21 BR-04 / BR-05: chống phát hành trùng
  EINVOICE_RESUBMISSION_REFUSED:
    "Không gửi lại được: nhà cung cấp có thể đang giữ hoá đơn này. Liên hệ nhà cung cấp rồi bấm “Tra lại”.",
  EINVOICE_PROVIDER_CANNOT_CORRECT:
    "Nhà cung cấp đang dùng chưa hỗ trợ điều chỉnh / thay thế. Chứng từ được giữ ở dạng nháp.",
  EINVOICE_NOT_IN_FORCE: "Chỉ điều chỉnh / thay thế được hoá đơn đã phát hành còn hiệu lực.",
  // docs 21 BR-08: đã điều chỉnh thì không thay thế và ngược lại
  EINVOICE_CORRECTION_FORM_FIXED:
    "Hoá đơn đang được chỉnh theo hình thức kia (điều chỉnh / thay thế) — giữ hình thức đã dùng trước.",
  EINVOICE_CORRECTION_NOT_APPLICABLE: "Cách chỉnh này không áp dụng cho hoá đơn này.",
  EINVOICE_AGREEMENT_REQUIRED:
    "Cần gắn văn bản thoả thuận với bên mua (tệp, số, ngày) trước khi phát hành điều chỉnh vì sai sót.",
  EINVOICE_ADJUSTMENT_EXCEEDS_INVOICE: "Điều chỉnh giảm vượt quá giá trị còn lại của hoá đơn.",
  EINVOICE_ERROR_NOTICE_NOT_FOUND: "Không tìm thấy thông báo sai sót.",
  EINVOICE_ERROR_NOTICE_NOT_SENDABLE:
    "Không gửi được thông báo này: hoá đơn còn thông báo khác đang mở, hoặc thông báo đã có phản hồi.",
  UNSUPPORTED_MEDIA_TYPE: "Văn bản thoả thuận phải là tệp PDF.",
  OPTIMISTIC_LOCK: "Hoá đơn vừa được người khác cập nhật. Dữ liệu đã được tải lại.",
};

export function einvoiceErrorMessage(error: unknown): string {
  return apiErrorMessage(error, EINVOICE_ERROR_MESSAGES);
}

/** Lỗi "dữ liệu đã đổi": tải lại hoá đơn trước khi cho thao tác tiếp. */
export const EINVOICE_STALE_CODES = [
  "EINVOICE_NOT_DRAFT",
  "EINVOICE_INVALID_TRANSITION",
  "OPTIMISTIC_LOCK",
] as const;
