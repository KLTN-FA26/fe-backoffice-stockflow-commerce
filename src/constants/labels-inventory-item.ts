/**
 * Nhãn, thông báo và lỗi của màn Hồ sơ hàng tồn (BE PR #119 `InventoryItemController`).
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
  searchPlaceholder: "Tìm SKU hoặc mã vạch",
  field: {
    sku: "SKU",
    version: "Phiên bản",
    unitOfMeasure: "Đơn vị tính",
    barcode: "Mã vạch",
    weightKg: "Khối lượng (kg)",
    lengthCm: "Dài (cm)",
    widthCm: "Rộng (cm)",
    heightCm: "Cao (cm)",
    packageWeightKg: "Kiện: khối lượng (kg)",
    packageLengthCm: "Kiện: dài (cm)",
    packageWidthCm: "Kiện: rộng (cm)",
    packageHeightCm: "Kiện: cao (cm)",
    packageCount: "Số kiện / đơn vị",
    packSize: "Đơn vị / gói",
    rotatable: "Cho phép xoay kiện khi xếp xe",
  },
  empty: {
    noItems: "Chưa có hồ sơ hàng tồn",
    noItemsHint: "Hồ sơ được tạo tự động khi thêm biến thể (SKU) cho sản phẩm.",
    noResults: "Không tìm thấy hồ sơ hàng tồn phù hợp",
    clearFilters: "Bỏ bộ lọc",
    firstPage: "Về trang đầu",
  },
  invalidPage: "Trang không hợp lệ — đã quay về trang đầu.",
  editLogistics: "Sửa logistics",
  cancel: "Huỷ",
  notFound: "Không tìm thấy hồ sơ hàng tồn này.",
  version: (v: number) => `Phiên bản ${v}`,
  // Trang chi tiết
  back: "Quay lại",
  logisticsTitle: "Logistics",
  saveLogistics: "Lưu logistics",
  saving: "Đang lưu…",
  logisticsDialogDescription: "Đơn vị tính, mã vạch, khối lượng, kích thước và cách xoay kiện.",
  outdatedNotice:
    "Hồ sơ vừa được người khác cập nhật — kiểm tra lại trước khi lưu; lưu bây giờ sẽ bị từ chối (409) và tải lại.",
  notProvided: "Chưa có",
  weightView: "Khối lượng",
  listRefetching: "Đang tải lại danh sách hồ sơ hàng tồn",
  listCaption: (shown: number, total: number) => `Hiển thị ${shown} / ${total} hồ sơ hàng tồn`,
  summary: {
    search: "Search chính",
    scope: "Trường search",
    columns: "Cột hiển thị",
    none: "Chưa dùng",
  },
  validation: {
    mustBePositive: "Phải lớn hơn 0",
    integerAtLeast1: "Số nguyên ≥ 1",
    uomFormat: "Đơn vị tính 1–16 ký tự in hoa, số hoặc _",
    barcodeMax: "Mã vạch tối đa 64 ký tự",
  },
  yes: "Có",
  no: "Không",
  dimensions: "Kích thước",
  packageDimensions: "Kiện giao",
  countAndPack: "Số kiện / đơn vị · Quy cách",
  packSuffix: "/gói",
  /** Tóm tắt chỉ đọc trong panel biến thể của sản phẩm (BE PR #119) — sửa ở trang Hồ sơ hàng tồn. */
  variantSummary: {
    title: "Logistics của SKU",
    openInInventory: "Mở hồ sơ tồn kho",
    loading: "Đang tải logistics…",
    noPermission: "Logistics do bộ phận kho quản lý — bạn không có quyền xem.",
    noItem: "SKU chưa có hồ sơ tồn kho.",
    // Lỗi tải `GET /inventory/items/{id}` (BE PR #119) ở panel biến thể
    notFound: "Không tìm thấy hồ sơ hàng tồn của SKU.",
    forbidden: "Bạn không có quyền xem hồ sơ hàng tồn của SKU.",
    loadFailed: "Không tải được hồ sơ hàng tồn của SKU. Vui lòng thử lại.",
    weightValue: (kg: number) => `${kg} kg`,
  },
} as const;

export const INVENTORY_ITEM_TOAST_MESSAGES = {
  logisticsSaved: "Đã lưu logistics",
} as const;

/** BE `errorCode` của hồ sơ hàng tồn (BE PR #119) → câu tiếng Việt; message BE là tiếng Anh. */
export const INVENTORY_ITEM_ERROR_MESSAGES = {
  INVENTORY_ITEM_NOT_FOUND: "Không tìm thấy hồ sơ hàng tồn này — có thể SKU đã bị xoá.",
  OPTIMISTIC_LOCK: "Hồ sơ vừa được người khác sửa. Dữ liệu đã được tải lại, hãy nhập lại.",
  /** INVENTORY_POLICY_STOCK_CONFLICT khi lưu logistics = đổi ĐVT lúc còn tồn. */
  UOM_STOCK_CONFLICT:
    "Không đổi được đơn vị tính khi SKU còn tồn kho — mọi số lượng đã đếm đang theo đơn vị cũ.",
  INVENTORY_POLICY_STOCK_CONFLICT:
    "SKU đang có tồn hoặc lô hàng nên chưa đổi được cách theo dõi / xuất kho / hạn dùng theo hướng này.",
  CONFLICT: "Mã vạch này đã được dùng cho SKU khác.",
  /** BE #121 InventoryItemsImpl: SKU ngừng dùng thì hồ sơ chỉ còn đọc, sửa logistics là 409. */
  VARIANT_OBSOLETE: "SKU đã ngừng dùng — hồ sơ hàng tồn chỉ còn xem, không sửa được nữa.",
  /**
   * BE #121 InventoryItemsImpl.saveLogistics (409): đơn vị tính cơ bản mới trùng mã một đơn vị đóng
   * gói đã khai báo của SKU.
   */
  UOM_CONVERSION_DUPLICATE:
    "SKU đã có đơn vị đóng gói mang mã này — chọn mã đơn vị tính khác hoặc bỏ đơn vị đóng gói đó trước.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;
