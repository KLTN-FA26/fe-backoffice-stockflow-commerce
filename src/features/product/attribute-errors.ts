/**
 * Lỗi BE của từ điển thuộc tính / bộ thuộc tính danh mục / trục sản phẩm → câu tiếng Việt.
 * Chỉ rẽ nhánh theo `errorCode` ổn định của BE; không lộ message tiếng Anh.
 */
import { ApiError } from "@/lib/api/error";

export type AttributeErrorContext =
  "load" | "save" | "delete" | "value" | "category" | "axes" | "descriptives" | "generate";

const CODE_MESSAGE: Record<string, string> = {
  ATTRIBUTE_CODE_ALREADY_EXISTS: "Mã này đã tồn tại (thuộc tính hoặc giá trị cùng thuộc tính).",
  ATTRIBUTE_IN_USE:
    "Đang được sản phẩm hoặc danh mục sử dụng nên không xoá hay gỡ được. Hãy vô hiệu hoá thay vì xoá.",
  ATTRIBUTE_NOT_FOUND: "Không tìm thấy thuộc tính — có thể đã bị xoá. Dữ liệu đã được tải lại.",
  ATTRIBUTE_VALUE_NOT_FOUND: "Không tìm thấy giá trị — có thể đã bị xoá. Dữ liệu đã được tải lại.",
  CATEGORY_NOT_FOUND: "Không tìm thấy danh mục.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  OPTIMISTIC_LOCK: "Dữ liệu vừa được người khác sửa. Đã tải lại, hãy kiểm tra rồi thử lại.",
  PRODUCT_AXES_LOCKED:
    "Chỉ thêm hoặc gỡ trục khi sản phẩm còn Nháp và chưa có biến thể nào mang tuỳ chọn. Vẫn thêm được giá trị cho trục đã có.",
  INVALID_PRODUCT_STATUS_TRANSITION:
    "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh nên không sửa được.",
  VARIANT_OPTIONS_INVALID:
    "Tuỳ chọn không hợp lệ: sản phẩm chưa có trục, hoặc có trục không còn giá trị nào đang dùng.",
  VARIANT_MATRIX_TOO_LARGE:
    "Quá nhiều biến thể cho một lần sinh (tối đa 100). Bỏ bớt giá trị của một trục rồi sinh lại.",
  VARIANT_SKU_ALREADY_EXISTS:
    "Có mã SKU bị trùng (với biến thể khác hoặc giữa hai tổ hợp). Đổi mã giá trị rồi thử lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
};

/** `VALIDATION_FAILED` của BE mang câu tiếng Anh cụ thể; chỉ hiện tên trường để người dùng biết chỗ sửa. */
export function attributeErrorMessage(error: unknown, context: AttributeErrorContext): string {
  if (!(error instanceof ApiError)) return "Không thực hiện được thao tác. Vui lòng thử lại.";
  if (error.code === "VALIDATION_FAILED") {
    const field = Object.keys(error.fieldErrors ?? {})[0];
    const base =
      context === "axes" || context === "generate"
        ? "Trục hoặc tuỳ chọn chưa hợp lệ: mỗi trục cần ít nhất một giá trị đang dùng, thuộc tính đa trị không làm trục được, và một thuộc tính không vừa là trục vừa là mô tả."
        : context === "descriptives"
          ? "Giá trị mô tả chưa hợp lệ: thuộc tính một lựa chọn cần đúng một giá trị, đa lựa chọn cần ít nhất một, các loại khác cần đúng một giá trị cùng kiểu."
          : "Dữ liệu chưa hợp lệ.";
    return field ? `${base} (${field})` : base;
  }
  const known = CODE_MESSAGE[error.code];
  if (known) return known;
  if (error.status === 403) return CODE_MESSAGE.FORBIDDEN ?? "";
  return "Không thực hiện được thao tác. Vui lòng thử lại.";
}

/**
 * Mã mà câu ở trên nói "Đã tải lại": dữ liệu trên màn đã cũ (người khác sửa / xoá thuộc tính, giá trị).
 * Mutation thuộc tính / trục bọc `withStaleRefetch` theo hàm này để câu đó là thật.
 */
const STALE_CODES = new Set([
  "OPTIMISTIC_LOCK",
  "ATTRIBUTE_NOT_FOUND",
  "ATTRIBUTE_VALUE_NOT_FOUND",
]);

export function isStaleAttributeError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}
