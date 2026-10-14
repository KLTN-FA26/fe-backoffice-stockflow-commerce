/** Lỗi BE → câu tiếng Việt (messages_vi; BE trả message tiếng Anh cho lỗi nghiệp vụ). */

import { ApiError } from "@/lib/api/error";
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

/**
 * Lỗi khu đóng gói khi QC hoàn tất LSX đơn (SCRUM-412, BE `WorkshopStock.packingArea`): BE không trả
 * fieldErrors nên FE gắn về ô "Khu đóng gói" — tổng đạt + lỗi đã được kiểm ở client trước khi gửi.
 */
export function qcPackingFieldError(error: unknown, packingLocation: string): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "LOCATION_NOT_FOUND") return "Không có vị trí này trong kho của lệnh.";
  if (error.code !== "VALIDATION_FAILED") return null;
  return packingLocation
    ? "Vị trí này không phải khu đóng gói (PACKING) đang dùng được."
    : "Kho có nhiều hoặc chưa có khu đóng gói dùng được — nhập rõ khu nhận hàng.";
}

/** `GET /production/orders/{id}/print-file` — BE đối chiếu checksum ngay khi cấp link (BR-PRD-02). */
const PRINT_FILE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: "Thiết kế đã khoá của lệnh này chưa có file in (PRINT_READY).",
  CONFLICT:
    "File in không khớp checksum của thiết kế đã khoá — không cấp link. Báo Sales để xử lý thiết kế.",
};

export function printFileErrorMessage(error: unknown): string {
  return apiErrorMessage(error, PRINT_FILE_ERROR_MESSAGES);
}

export const PRODUCTION_STALE_CODES = [
  "INVALID_PRODUCTION_TRANSITION",
  "IDEMPOTENT_REQUEST_IN_PROGRESS",
] as const;
