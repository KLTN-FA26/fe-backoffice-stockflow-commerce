import type { ApiError } from "@/lib/api";

export function productTransitionErrorMessage(error: ApiError): string {
  switch (error.code) {
    case "SELF_APPROVAL_NOT_ALLOWED":
      return "Bạn không thể phê duyệt sản phẩm do chính mình gửi duyệt.";
    case "INVALID_PRODUCT_STATUS_TRANSITION":
      return "Trạng thái sản phẩm đã thay đổi hoặc không còn phù hợp với thao tác này.";
    case "FORBIDDEN":
    case "ACCESS_DENIED":
    case "OUT_OF_DATA_SCOPE":
      return "Bạn không có quyền thực hiện thao tác này.";
    case "VALIDATION_FAILED":
      if (error.fieldErrors?.reason) return "Vui lòng nhập lý do từ chối.";
      return "Dữ liệu chuyển trạng thái không hợp lệ.";
    default:
      return error.message || "Không thể cập nhật trạng thái sản phẩm.";
  }
}
