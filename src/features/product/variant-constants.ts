export const CANONICAL_VARIANT_READ_PERMISSION = "product-products:READ";
export const CANONICAL_VARIANT_PAGE_PARAM = "variantPage";
export const CANONICAL_VARIANT_TEXT = {
  listTitle: "Biến thể canonical",
  detailTitle: "Chi tiết SKU canonical",
  description: "Luồng Product/Variant UUID riêng biệt; không thay thế SKU legacy.",
  denied: "Bạn không có quyền đọc sản phẩm.",
  mockUnavailable:
    "Luồng canonical cần API Product/Variant thật; không dùng định danh SKU minh hoạ.",
  invalid: "Đường dẫn cần Product UUID và Variant UUID hợp lệ.",
  mismatch: "Định danh Product/Variant trả về không khớp đường dẫn yêu cầu.",
  malformed: "Dữ liệu trả về không đúng định dạng.",
  failed: "Không tải được biến thể canonical. Kiểm tra API hoặc thử lại.",
  paused: "Đang chờ kết nối để đọc biến thể canonical.",
  empty: "Chưa có biến thể canonical.",
  retry: "Thử lại",
  previous: "Trang trước",
  next: "Trang sau",
  productId: "Product UUID",
  variantId: "Variant UUID",
  sku: "Mã SKU",
  name: "Tên biến thể",
} as const;
