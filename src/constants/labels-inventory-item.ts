/**
 * Nhãn, thông báo và lỗi của màn Hồ sơ hàng tồn (BE `InventoryItemController`).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.inventoryItem` / `TOAST_MESSAGES.inventoryItem` trỏ về đây.
 */

/**
 * Nhãn mặc định của ô chọn SKU theo hồ sơ hàng tồn dùng chung (`InventoryItemCombobox`, BE `GET /inventory/items?q=`).
 * Màn nào cần lời riêng (vd danh mục NCC) truyền bộ nhãn cùng hình dạng qua prop `labels`.
 */
export const INVENTORY_ITEM_PICKER_LABELS = {
  placeholder: "Chọn SKU trong hồ sơ hàng tồn",
  search: "Tìm theo SKU hoặc mã vạch",
  loading: "Đang tìm hồ sơ hàng tồn…",
  empty: "Không có SKU phù hợp",
  // Chỉ lấy trang đầu kết quả (INVENTORY_ITEM_OPTIONS_PAGE_SIZE) — còn nữa thì nhắc gõ thêm
  moreResults: "Còn nhiều kết quả khác — gõ thêm SKU hoặc mã vạch để thu hẹp.",
  emptyButMore: "Các kết quả đầu không dùng được — gõ thêm SKU hoặc mã vạch để tìm SKU khác.",
  loadFailed: "Không tải được hồ sơ hàng tồn.",
  retry: "Thử lại",
  barcode: (code: string) => `Mã vạch ${code}`,
} as const;

export interface InventoryItemPickerLabels {
  placeholder: string;
  search: string;
  loading: string;
  empty: string;
  moreResults: string;
  emptyButMore: string;
  loadFailed: string;
  retry: string;
  barcode: (code: string) => string;
}

export const INVENTORY_ITEM_UI_LABELS = {
  title: "Hồ sơ hàng tồn",
  subtitle: "Logistics của từng SKU — tạo tự động cùng biến thể sản phẩm.",
  searchPlaceholder: "Tìm SKU hoặc mã vạch",
  field: {
    sku: "SKU",
    unitOfMeasure: "Đơn vị tính",
    barcode: "Mã vạch",
    rotatable: "Cho phép xoay kiện khi xếp xe",
  },
  /** Docs 01 §3 "Chính sách tồn", BR-17 (chốt 2026-11-05) — cố định, không cấu hình. */
  stockRules: {
    title: "Chính sách tồn",
    tracking: "Theo dõi",
    trackingValue: "Theo lô (lô = mã Đơn sản xuất)",
    serial: "Số serial",
    serialValue: "Không theo dõi",
    expiry: "Hạn dùng",
    expiryValue: "Không theo dõi",
    removal: "Cách xuất kho",
    removalValue: "FIFO — nhập trước xuất trước",
    hint: "Áp dụng cố định cho mọi SKU; hệ thống tự gán lô khi nhập kho, không cần cấu hình.",
  },
  empty: {
    noItems: "Chưa có hồ sơ hàng tồn",
    noItemsHint: "Hồ sơ được tạo tự động khi thêm biến thể (SKU) cho sản phẩm.",
    noResults: "Không tìm thấy hồ sơ hàng tồn phù hợp",
    clearFilters: "Bỏ tìm kiếm",
    firstPage: "Về trang đầu",
  },
  invalidPage: "Trang không hợp lệ — đã quay về trang đầu.",
  editLogistics: "Sửa logistics",
  notFound: "Không tìm thấy hồ sơ hàng tồn này.",
  logisticsTitle: "Logistics",
  saveLogistics: "Lưu logistics",
  saving: "Đang lưu…",
  // BE #396 (docs 01 BR-03): kích thước, khối lượng là của thùng — khai ở quy cách thùng của SKU
  logisticsDialogDescription:
    "Đơn vị tính, mã vạch, cho phép xoay kiện. Kích thước và khối lượng khai ở quy cách thùng của SKU.",
  outdatedNotice:
    "Hồ sơ vừa được người khác cập nhật — kiểm tra lại trước khi lưu; lưu bây giờ sẽ bị từ chối (409) và tải lại.",
  notProvided: "Chưa có",
  listRefetching: "Đang tải lại danh sách hồ sơ hàng tồn",
  listCaption: (shown: number, total: number) => `Hiển thị ${shown} / ${total} hồ sơ hàng tồn`,
  summary: {
    search: "Tìm kiếm chính",
    scope: "Tìm theo",
    columns: "Cột hiển thị",
    none: "Chưa dùng",
  },
  validation: {
    uomFormat: "Đơn vị tính 1–16 ký tự in hoa, số hoặc _",
    barcodeMax: "Mã vạch tối đa 64 ký tự",
  },
  yes: "Có",
  no: "Không",
} as const;

export const INVENTORY_ITEM_TOAST_MESSAGES = {
  logisticsSaved: "Đã lưu logistics",
} as const;

/** BE `errorCode` của hồ sơ hàng tồn → câu tiếng Việt; message BE là tiếng Anh. */
export const INVENTORY_ITEM_ERROR_MESSAGES = {
  INVENTORY_ITEM_NOT_FOUND: "Không tìm thấy hồ sơ hàng tồn này — có thể SKU đã bị xoá.",
  OPTIMISTIC_LOCK: "Hồ sơ vừa được người khác sửa. Dữ liệu đã được tải lại, hãy nhập lại.",
  /** INVENTORY_POLICY_STOCK_CONFLICT khi lưu logistics = đổi ĐVT lúc còn tồn. */
  UOM_STOCK_CONFLICT:
    "Không đổi được đơn vị tính khi SKU còn tồn kho — mọi số lượng đã đếm đang theo đơn vị cũ.",
  /** BE `InventoryItemsImpl.saveLogistics`: mã vạch trùng hồ sơ khác (409 CONFLICT). */
  CONFLICT: "Mã vạch này đã được dùng cho SKU khác.",
  /** BE `InventoryItemsImpl.lockEditable`: SKU ngừng dùng thì hồ sơ chỉ còn đọc. */
  VARIANT_OBSOLETE: "SKU đã ngừng dùng — hồ sơ hàng tồn chỉ còn xem, không sửa được nữa.",
  /** BE `InventoryItemsImpl.saveLogistics` (409): đơn vị tính mới trùng mã một đơn vị đóng gói của SKU. */
  UOM_CONVERSION_DUPLICATE:
    "SKU đã có đơn vị đóng gói mang mã này — chọn mã đơn vị tính khác hoặc bỏ đơn vị đóng gói đó trước.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;
