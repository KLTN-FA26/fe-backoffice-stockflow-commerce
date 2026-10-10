export const INVENTORY_CONTROL_TEXT = {
  edit: "Chỉnh sửa",
  save: "Lưu",
  saving: "Đang lưu…",
  cancel: "Huỷ",
  editor: "Chỉnh sửa chính sách tồn kho",
  reload: "Tải lại chính sách (thay thế bản nháp)",
  reloading: "Đang tải lại…",
  reloadFailed: "Tải lại thất bại. Bản nháp và phiên bản gốc được giữ nguyên.",
  saveFailed: "Không thể lưu chính sách tồn kho.",
  stateConflict:
    "Chính sách đã thay đổi hoặc trạng thái sản phẩm không cho phép lưu. Tải lại để kiểm tra; bản nháp được giữ nguyên.",
  stockConflict: "Tồn kho hiện tại không tương thích với chính sách này.",
  countConflict: "Cần xử lý kỳ kiểm kê đang hoạt động trước khi thay đổi chính sách.",
  numeric: "Nhập số nguyên không âm có thể biểu diễn chính xác.",
  thresholdRelation: "Tồn kho an toàn không được lớn hơn điểm đặt hàng lại.",
  expiryTracking: "Theo dõi hạn sử dụng yêu cầu chế độ LOT hoặc LOT_SERIAL.",
  expiryRemoval: "Theo dõi hạn sử dụng yêu cầu FEFO.",
  shelfExpiry: "Thời hạn sử dụng chỉ được cấu hình khi theo dõi hạn sử dụng.",
  shelfRange: "Thời hạn sử dụng phải từ 1 đến 36.500 ngày.",
  title: "Inventory Control Settings",
  policy: "Chính sách tồn kho",
  evaluation: "Đánh giá tồn kho hiện tại",
  reorderPoint: "Điểm đặt hàng lại",
  safetyStock: "Tồn kho an toàn",
  removalStrategy: "Chiến lược xuất kho",
  trackingMode: "Chế độ theo dõi",
  expiryTracked: "Theo dõi hạn sử dụng",
  maxShelfLifeDays: "Thời hạn sử dụng tối đa",
  usableOnHand: "Tồn kho khả dụng thực tế",
  reorderRequired: "Cần đặt hàng lại",
  belowSafetyStock: "Dưới mức tồn kho an toàn",
  unconfigured: "Chưa cấu hình",
  unknown: "Chưa có dữ liệu",
  yes: "Có",
  no: "Không",
  days: "ngày",
  loading: "Đang tải chính sách tồn kho",
  refreshing: "Đang tải lại chính sách tồn kho",
  paused: "Đang ngoại tuyến. Chính sách tồn kho sẽ tải khi kết nối được khôi phục.",
  denied: "Bạn không có quyền đọc chính sách tồn kho.",
  invalid: "Định danh Product/Variant không hợp lệ.",
  mockUnavailable: "Chính sách tồn kho cần backend canonical thực; không có chính sách mock.",
  failed: "Không thể tải chính sách tồn kho.",
  malformed: "Phản hồi chính sách tồn kho không đúng hợp đồng dữ liệu.",
  mismatch: "Định danh Variant trong chính sách tồn kho không khớp với yêu cầu.",
  retry: "Thử lại",
} as const;

export const INVENTORY_CONTROL_UPDATE_PERMISSION = "product-products:UPDATE";
// Java Integer wire representation, not a purchasing/business limit.
export const JAVA_INTEGER_MAX = 2147483647;
export const MAX_SHELF_LIFE_DAYS = 36500; // StockPolicy.validate / UpdateInventoryControlRequest.

export const REMOVAL_STRATEGY_LABELS = {
  FIFO: "Nhập trước, xuất trước (FIFO)",
  FEFO: "Hết hạn trước, xuất trước (FEFO)",
};
export const TRACKING_MODE_LABELS = {
  NONE: "Không theo dõi",
  LOT: "Theo lô",
  SERIAL: "Theo số sê-ri",
  LOT_SERIAL: "Theo lô và số sê-ri",
};
