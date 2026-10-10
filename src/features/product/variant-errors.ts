/**
 * Lỗi BE của biến thể / logistics / ảnh → câu tiếng Việt. Không lộ message tiếng Anh của BE.
 * `INVALID_VARIANT_TRANSITION` dùng cho nhiều luật khác nhau, nên câu tuỳ thao tác (`context`).
 */
import { ApiError } from "@/lib/api/error";

export type VariantErrorContext =
  | "activate"
  | "block"
  | "obsolete"
  | "save"
  | "logistics"
  | "upload"
  | "publish"
  | "media"
  | "load";

const TRANSITION_MESSAGE: Partial<Record<VariantErrorContext, string>> = {
  activate:
    "Chỉ kích hoạt được biến thể khi sản phẩm đã được duyệt và biến thể đang ở Nháp hoặc Tạm chặn.",
  block: "Chỉ tạm chặn được biến thể đang dùng.",
  obsolete:
    "Không ngừng dùng được biến thể này. Biến thể mặc định không ngừng riêng — hãy ngừng kinh doanh sản phẩm.",
  save: "Mã SKU chỉ đổi được khi biến thể còn Nháp.",
  upload: "Biến thể đã ngừng dùng không nhận ảnh mới.",
};

const CODE_MESSAGE: Record<string, string> = {
  VARIANT_SKU_ALREADY_EXISTS: "Mã SKU đã được dùng cho biến thể khác.",
  VARIANT_NOT_FOUND: "Không tìm thấy biến thể — có thể đã bị đổi. Dữ liệu đã được tải lại.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  MEDIA_NOT_FOUND: "Không tìm thấy ảnh — có thể đã bị xoá. Dữ liệu đã được tải lại.",
  OPTIMISTIC_LOCK: "Thông tin vừa được người khác sửa. Dữ liệu đã được tải lại, hãy nhập lại.",
  INVENTORY_POLICY_STOCK_CONFLICT:
    "Không đổi được đơn vị tính khi SKU còn tồn kho — mọi số lượng đã đếm đang theo đơn vị cũ.",
  PRODUCT_NOT_APPROVED: "Sản phẩm phải được duyệt trước khi xuất bản ảnh.",
  SELF_APPROVAL_NOT_ALLOWED: "Ảnh phải do người khác người tải lên xuất bản (duyệt bốn mắt).",
  PAYLOAD_TOO_LARGE: "Ảnh quá lớn (tối đa 25 megapixel và giới hạn dung lượng của hệ thống).",
  UNSUPPORTED_MEDIA_TYPE: "Định dạng ảnh không được hỗ trợ.",
  STORAGE_ERROR: "Kho ảnh tạm thời không phản hồi. Vui lòng thử lại sau.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
};

const CONFLICT_MESSAGE: Partial<Record<VariantErrorContext, string>> = {
  publish: "Chỉ xuất bản được ảnh đã tải lên và đã tạo bản hiển thị — hãy tải lại ảnh đó.",
  logistics: "SKU này không thuộc sản phẩm đang xem.",
};

export function variantErrorMessage(error: unknown, context: VariantErrorContext): string {
  if (!(error instanceof ApiError)) return "Không thực hiện được thao tác. Vui lòng thử lại.";
  if (error.code === "INVALID_VARIANT_TRANSITION") {
    return TRANSITION_MESSAGE[context] ?? "Biến thể đã đổi trạng thái. Dữ liệu đã được tải lại.";
  }
  if (error.code === "CONFLICT" && CONFLICT_MESSAGE[context]) return CONFLICT_MESSAGE[context];
  const known = CODE_MESSAGE[error.code];
  if (known) {
    const field = Object.keys(error.fieldErrors ?? {})[0];
    return error.code === "VALIDATION_FAILED" && field ? `${known} (${field})` : known;
  }
  if (error.status === 403) return CODE_MESSAGE.FORBIDDEN ?? "";
  if (error.status === 413) return CODE_MESSAGE.PAYLOAD_TOO_LARGE ?? "";
  if (error.status === 415) return CODE_MESSAGE.UNSUPPORTED_MEDIA_TYPE ?? "";
  return "Không thực hiện được thao tác. Vui lòng thử lại.";
}
