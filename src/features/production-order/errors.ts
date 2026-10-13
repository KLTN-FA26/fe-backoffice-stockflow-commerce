/** Lỗi BE → câu tiếng Việt (messages_vi; BE trả message tiếng Anh cho lỗi nghiệp vụ). */

import { apiErrorMessage } from "@/lib/api/error-message";

export const PRODUCTION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_PRODUCTION_TRANSITION:
    "Lệnh sản xuất không thể chuyển sang trạng thái này lúc này (có thể người khác vừa thao tác, đơn bán đã huỷ hoặc còn phôi ở nhà gia công). Dữ liệu đã được tải lại.",
  PRINT_FILE_MISMATCH: "File in không khớp với thiết kế đã khoá — không thể duyệt prepress.",
  RESERVATION_NOT_ISSUABLE: "Phiếu giữ phôi này không thể xuất.",
  ISSUE_EXCEEDS_REQUIREMENT: "Số phôi vượt quá số lệnh sản xuất còn cần (BR-PRD-03).",
  INSUFFICIENT_STOCK: "Không đủ phôi trong kho.",
  LOCATION_NOT_FOUND: "Không tìm thấy vị trí trong kho của lệnh.",
  LOCATION_NOT_USABLE: "Vị trí này hiện không nhận hàng được.",
  OUT_OF_DATA_SCOPE: "Lệnh sản xuất thuộc kho bạn không được phân công.",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp.",
  SUPPLIER_NOT_SUBCONTRACTOR: "Nhà cung cấp này không phải nhà gia công in.",
  INVENTORY_ITEM_NOT_FOUND: "SKU này chưa có mặt hàng kho.",
  INVALID_PURCHASE_ORDER_TRANSITION: "Đơn đặt gia công hiện không thể điều chỉnh.",
  QC_AREA_MISSING: "Kho chưa có khu QC.",
  IDEMPOTENT_REQUEST_IN_PROGRESS: "Yêu cầu tương tự đang được xử lý.",
  IDEMPOTENCY_KEY_REUSED: "Mã yêu cầu đã dùng cho thao tác khác. Tải lại trang rồi thử lại.",
  NOT_FOUND: "Không tìm thấy dữ liệu (file in, quyết toán) cho lệnh này.",
  VALIDATION_FAILED:
    "Dữ liệu chưa hợp lệ (vd tổng đạt + lỗi phải bằng số chờ QC, kho có nhiều khu đóng gói cần chọn rõ).",
};

export function productionErrorMessage(error: unknown): string {
  return apiErrorMessage(error, PRODUCTION_ERROR_MESSAGES);
}

export const PRODUCTION_STALE_CODES = [
  "INVALID_PRODUCTION_TRANSITION",
  "IDEMPOTENT_REQUEST_IN_PROGRESS",
] as const;
