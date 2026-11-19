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
  // BE `findEarlierSubmitting`: hoá đơn cùng NCC / mẫu số / ký hiệu, ngày lập sớm hơn, đang SUBMITTING —
  // nháp hay bị từ chối ngày sớm hơn KHÔNG chặn (chỉ là cảnh báo EARLIER_INVOICE_PENDING)
  EINVOICE_OLDER_DRAFT_PENDING:
    "Một hoá đơn cùng ký hiệu có ngày lập sớm hơn đang chờ nhà cung cấp trả kết quả. Chờ kết quả của hoá đơn đó (hoặc bấm “Kiểm tra lại” trên hoá đơn đó) rồi phát hành hoá đơn này.",
  EINVOICE_NOT_ISSUED: "Hoá đơn chưa phát hành nên chưa có tệp XML / PDF.",
  EINVOICE_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp hoá đơn điện tử đang không phản hồi. Hệ thống sẽ tự kiểm tra lại.",
  EINVOICE_PROVIDER_ACCOUNT_INCOMPLETE:
    "Chưa lưu tài khoản nhà cung cấp hoá đơn điện tử. Nhờ Quản trị hệ thống cấu hình.",
  // docs 21 BR-04 / BR-05: chống phát hành trùng
  EINVOICE_RESUBMISSION_REFUSED:
    "Không gửi lại được: nhà cung cấp có thể đang giữ hoá đơn này. Liên hệ nhà cung cấp rồi bấm “Kiểm tra lại”.",
  // BE HĐ-1 (PR #369): rút hoá đơn kẹt ở NCC. Lỗi không mang mốc thời gian máy đọc được → câu cố định nêu cả hai mốc
  // (`withdraw-after` 3 giờ khi NCC báo không tìm thấy, `withdraw-unknown-after` 1 ngày khi NCC chưa trả lời rõ).
  EINVOICE_WITHDRAWAL_REFUSED:
    "Chưa rút được hoá đơn. Hệ thống chỉ cho rút 3 giờ sau lần gửi cuối khi nhà cung cấp báo không tìm thấy hoá đơn, hoặc 1 ngày sau lần gửi cuối khi nhà cung cấp chưa trả lời rõ. Bấm “Kiểm tra lại” rồi thử rút sau.",
  // BE HĐ-5: điều chỉnh / thay thế chỉ đi qua NCC đã phát hành hoá đơn gốc
  EINVOICE_ORIGINAL_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp đã phát hành hoá đơn gốc không còn dùng được (chưa có tài khoản hoặc ký hiệu cho năm). Không gửi điều chỉnh / thay thế qua nhà cung cấp khác — nhờ Quản trị hệ thống cấu hình lại.",
  // BE HĐ-1: NCC không có mẫu số + ký hiệu này trên tài khoản
  EINVOICE_SERIES_NOT_AT_PROVIDER:
    "Nhà cung cấp không có mẫu số và ký hiệu này trên tài khoản. Nhờ Quản trị hệ thống chọn ký hiệu đã đăng ký với nhà cung cấp.",
  // BE HĐ-7: dòng thuế suất 0% (không chịu thuế) chưa phát hành được
  EINVOICE_TAX_EXEMPT_NOT_SUPPORTED:
    "Hoá đơn có dòng hàng không chịu thuế (0%) — chưa phát hành được. Sửa nhóm thuế của sản phẩm rồi huỷ và lập lại hoá đơn nháp.",
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
  // BE HĐ-6: SePay / Viettel không gửi được mẫu 04/SS-HĐĐT
  EINVOICE_ERROR_NOTICE_NOT_SUPPORTED:
    "Nhà cung cấp của hoá đơn này không gửi được thông báo sai sót. Lập mẫu 04/SS-HĐĐT trên cổng của nhà cung cấp hoặc cổng cơ quan thuế.",
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
