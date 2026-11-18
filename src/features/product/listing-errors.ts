/**
 * Lỗi BE của listing TMĐT → câu tiếng Việt. `CONFLICT` của BE dùng cho nhiều luật (revision lệch, sản phẩm
 * đã ngừng, slug đã cố định sau khi từng xuất bản) nên câu nêu cả ba.
 */
import { ApiError } from "@/lib/api/error";

const CODE_MESSAGE: Record<string, string> = {
  CATALOG_SLUG_EXISTS: "Đường dẫn này đã được sản phẩm khác dùng. Hãy chọn đường dẫn khác.",
  CATALOG_LISTING_REQUIRED:
    "Hãy lưu thông tin cửa hàng (đường dẫn) của sản phẩm trước khi xuất bản.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ: kiểm tra đường dẫn hoặc mô tả SEO.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
};

export function listingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Không thực hiện được thao tác. Vui lòng thử lại.";
  if (error.code === "CONFLICT") {
    return "Không lưu được: dữ liệu vừa được người khác sửa, sản phẩm đã ngừng kinh doanh, hoặc đường dẫn không đổi được vì sản phẩm từng xuất bản. Dữ liệu đã được tải lại.";
  }
  const known = CODE_MESSAGE[error.code];
  if (known) return known;
  if (error.status === 403) return CODE_MESSAGE.FORBIDDEN ?? "";
  return "Không thực hiện được thao tác. Vui lòng thử lại.";
}
