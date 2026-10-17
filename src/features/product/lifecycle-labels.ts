/**
 * Nhãn tiếng Việt cho cảnh báo ngừng kinh doanh, chứng từ còn mở và lịch sử thay đổi sản phẩm.
 * Mã trạng thái / cảnh báo chưa biết rơi về câu chung; tên trường chưa biết hiện nguyên tên BE.
 */
import type { OpenReference, ProductChangeType } from "./lifecycle-schemas";

/**
 * BE `ProductDiscontinuation.OPEN_PURCHASE_ORDER_LINES` / `UNSHIPPED_ORDER_LINES`. Đây là cảnh báo,
 * không phải lỗi: sản phẩm đã ngừng kinh doanh (BR-PRD-005, docs 01 bước 12).
 */
const WARNING_LABEL: Record<string, string> = {
  OPEN_PURCHASE_ORDER_LINES:
    "Còn dòng đơn mua (PO) đang mở tham chiếu SKU của sản phẩm — hàng đang về vẫn được nhận.",
  UNSHIPPED_ORDER_LINES:
    "Còn dòng đơn bán đã đặt chưa giao tham chiếu SKU của sản phẩm — các đơn này vẫn được xử lý tiếp.",
};

export function discontinueWarningLabel(code: string): string {
  return WARNING_LABEL[code] ?? "Còn chứng từ đang mở tham chiếu SKU của sản phẩm.";
}

const REFERENCE_KIND_LABEL: Record<OpenReference["kind"], string> = {
  PURCHASE_ORDER_LINE: "Dòng đơn mua",
  SALES_ORDER_LINE: "Dòng đơn bán",
};
export const openReferenceKindLabel = (kind: OpenReference["kind"]): string =>
  REFERENCE_KIND_LABEL[kind];

export const CHANGE_TYPE_LABEL: Record<ProductChangeType, string> = {
  CREATED: "Tạo sản phẩm",
  UPDATED: "Cập nhật thông tin",
  SUBMITTED: "Gửi duyệt",
  APPROVED: "Phê duyệt",
  REJECTED: "Từ chối",
  SUSPENDED: "Tạm ngưng",
  RESUMED: "Tiếp tục kinh doanh",
  DISCONTINUED: "Ngừng kinh doanh",
  VARIANT_ADDED: "Thêm biến thể",
  VARIANT_UPDATED: "Sửa biến thể",
  VARIANT_STATUS: "Đổi trạng thái biến thể",
  MEDIA: "Ảnh",
  LOGISTICS: "Logistics của SKU",
  INVENTORY_CONTROL: "Chính sách tồn kho của SKU",
  UNKNOWN: "Thay đổi khác",
};

/** Trạng thái sản phẩm và biến thể BE ghi trong lịch sử (`fromStatus` / `toStatus`). */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PUBLISHED: "Đã xuất bản",
  INACTIVE: "Tạm ngưng",
  DISCONTINUED: "Ngừng kinh doanh",
  ACTIVE: "Đang dùng",
  BLOCKED: "Tạm chặn",
  OBSOLETE: "Ngừng dùng",
};
export const historyStatusLabel = (code: string): string => STATUS_LABEL[code] ?? "Không rõ";

/** Tên trường BE ghi trong `changedFields` (sản phẩm, biến thể, logistics, chính sách tồn kho). */
const FIELD_LABEL: Record<string, string> = {
  name: "Tên",
  nameEn: "Tên tiếng Anh",
  brandId: "Thương hiệu",
  categoryId: "Danh mục",
  shortDescription: "Mô tả ngắn",
  description: "Mô tả",
  descriptionEn: "Mô tả tiếng Anh",
  taxClass: "Loại thuế",
  kind: "Loại sản phẩm",
  axes: "Trục biến thể",
  descriptiveAttributes: "Thuộc tính mô tả",
  sku: "Mã SKU",
  attributeSignature: "Tổ hợp tuỳ chọn",
  position: "Vị trí",
  unitOfMeasure: "Đơn vị tính",
  barcode: "Mã vạch",
  weightKg: "Khối lượng",
  lengthCm: "Chiều dài",
  widthCm: "Chiều rộng",
  heightCm: "Chiều cao",
  packageWeightKg: "Kiện: khối lượng",
  packageLengthCm: "Kiện: chiều dài",
  packageWidthCm: "Kiện: chiều rộng",
  packageHeightCm: "Kiện: chiều cao",
  packageCount: "Số kiện",
  packSize: "Quy cách gói",
  requiresAdultSignature: "Giao cần người lớn ký nhận",
  shippingRestrictionNote: "Hạn chế vận chuyển",
  storageClass: "Điều kiện lưu kho",
  qcRequired: "Yêu cầu QC",
  reorderPoint: "Điểm đặt hàng lại",
  safetyStock: "Tồn an toàn",
  removalStrategy: "Chiến lược xuất kho",
  trackingMode: "Theo dõi lô / serial",
  expiryTracked: "Theo dõi hạn dùng",
  maxShelfLifeDays: "Hạn dùng tối đa",
};
export const changedFieldLabel = (field: string): string => FIELD_LABEL[field] ?? field;
