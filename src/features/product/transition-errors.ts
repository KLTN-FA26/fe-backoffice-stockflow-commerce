import { PRODUCT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api";

/** Branches on the stable BE errorCode only; the server message is a display fallback. */
export function productTransitionErrorMessage(error: ApiError): string {
  switch (error.code) {
    // BE ProductPublicationAdapter.publish: no approved image in the variant galleries (409).
    case "PRODUCT_GALLERY_REQUIRED":
      return "Cần duyệt ít nhất một ảnh trong gallery trước khi xuất bản sản phẩm.";
    // BE Product.submit (docs 01 §3): chưa có thương hiệu — fieldErrors[brandId].
    case "PRODUCT_BRAND_REQUIRED":
      return PRODUCT_ERROR_MESSAGES.brandRequired;
    // BE ProductPublicationAdapter.publish: SP không còn APPROVED / PUBLISHED, không còn danh mục
    // đang dùng / biến thể Đang dùng.
    case "PRODUCT_NOT_APPROVED":
      return PRODUCT_ERROR_MESSAGES.notApproved;
    case "PRODUCT_CATEGORY_REQUIRED":
      return PRODUCT_ERROR_MESSAGES.categoryRequired;
    case "PRODUCT_SKU_REQUIRED":
      return PRODUCT_ERROR_MESSAGES.skuRequired;
    case "SELF_APPROVAL_NOT_ALLOWED":
      return "Bạn không thể phê duyệt sản phẩm do chính mình gửi duyệt.";
    case "INVALID_PRODUCT_STATUS_TRANSITION":
      return "Trạng thái sản phẩm đã thay đổi hoặc không còn phù hợp với thao tác này.";
    // BE `Product.requireDeletable` (BR-02 docs 01): chỉ sản phẩm Nháp mới xoá được.
    case "PRODUCT_NOT_DELETABLE":
      return "Chỉ xoá được sản phẩm ở trạng thái Nháp. Sản phẩm đã gửi duyệt thì tạm ngưng hoặc ngừng kinh doanh.";
    // BE `ProductService.deleteDraft`: còn PO / đơn mở, hoặc tồn kho, nhận hàng, giỏ, thiết kế, listing tham chiếu SKU.
    case "PRODUCT_IN_USE":
      return "Sản phẩm còn được tồn kho, đơn mua, đơn bán, thiết kế hoặc cửa hàng tham chiếu nên không xoá được.";
    case "PRODUCT_NOT_FOUND":
      return "Không tìm thấy sản phẩm — có thể đã bị xoá.";
    // BE ProductService: `version` gửi lên không còn là bản mới nhất (409).
    case "OPTIMISTIC_LOCK":
      return "Sản phẩm vừa được người khác sửa. Dữ liệu đã được tải lại, hãy kiểm tra rồi thử lại.";
    case "FORBIDDEN":
    case "ACCESS_DENIED":
    case "OUT_OF_DATA_SCOPE":
      return "Bạn không có quyền thực hiện thao tác này.";
    case "VALIDATION_FAILED":
      if (error.fieldErrors?.reason) return "Vui lòng nhập lý do (tối đa 500 ký tự).";
      return "Dữ liệu chuyển trạng thái không hợp lệ.";
    default:
      return error.message || "Không thể cập nhật trạng thái sản phẩm.";
  }
}

/**
 * Bản sản phẩm trên màn đã cũ: `version` đổi (OPTIMISTIC_LOCK) hoặc trạng thái đã đổi ở nơi khác
 * (INVALID_PRODUCT_STATUS_TRANSITION, BE `Product.requireCanTransitionTo`; PRODUCT_NOT_APPROVED khi
 * xuất bản, BE `ProductPublicationAdapter.publish` — nút chỉ hiện lúc Approved). Mutation vòng đời bọc
 * `withStaleRefetch` theo hàm này để tải lại chi tiết — nút hiện đúng trạng thái thật, lần sau đúng version.
 */
const STALE_CODES = new Set([
  "OPTIMISTIC_LOCK",
  "INVALID_PRODUCT_STATUS_TRANSITION",
  "PRODUCT_NOT_APPROVED",
]);

export function isStaleProductError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}
