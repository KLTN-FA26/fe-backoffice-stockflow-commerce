/**
 * Nhãn, thông báo và lỗi của màn Hồ sơ hàng tồn (BE PR #119 `InventoryItemController`).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.inventoryItem` / `TOAST_MESSAGES.inventoryItem` trỏ về đây.
 */

export const INVENTORY_ITEM_UI_LABELS = {
  title: "Hồ sơ hàng tồn",
  subtitle: "Logistics và chính sách tồn của từng SKU — tạo tự động cùng biến thể sản phẩm.",
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
    storageClass: "Điều kiện lưu kho",
    trackingMode: "Theo dõi",
    requiresAdultSignature: "Giao hàng cần người lớn ký nhận",
    shippingRestrictionNote: "Hạn chế vận chuyển",
    qcRequired: "Nhập kho đi qua khu QC",
    rotatable: "Cho phép xoay kiện khi xếp xe",
    removalStrategy: "Cách xuất kho",
    expiryTracked: "Theo dõi hạn dùng",
    maxShelfLifeDays: "Hạn dùng tối đa (ngày)",
    reorderPoint: "Điểm đặt lại",
    safetyStock: "Tồn an toàn",
    maxQty: "Tồn tối đa",
    policyConfigured: "Chính sách",
    usableOnHand: "Tồn khả dụng",
    reorderRequired: "Cần đặt lại",
    belowSafetyStock: "Dưới mức an toàn",
  },
  storageClass: {
    NORMAL: "Thường",
    COLD: "Lạnh",
    HAZMAT: "Hàng nguy hiểm",
    FRAGILE: "Dễ vỡ",
    OVERSIZE: "Quá khổ",
  },
  trackingMode: {
    NONE: "Không theo dõi",
    LOT: "Theo lô",
    SERIAL: "Theo serial",
    LOT_SERIAL: "Lô + serial",
  },
  removalStrategy: {
    FIFO: "FIFO — nhập trước xuất trước",
    FEFO: "FEFO — hết hạn trước xuất trước",
  },
  policy: {
    configured: "Đã cấu hình",
    unconfigured: "Chưa cấu hình",
    notSet: "Chưa đặt",
    maxQtyHint:
      "Mức tồn bổ sung tới khi đặt hàng lại (order-up-to); ≥ điểm đặt lại và tồn an toàn.",
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
  editPolicy: "Sửa chính sách",
  cancel: "Huỷ",
  expiryHint: "Theo dõi hạn dùng cần theo dõi lô và xuất kho FEFO.",
  evaluationTitle: "Đánh giá ngưỡng",
  notFound: "Không tìm thấy hồ sơ hàng tồn này.",
  version: (v: number) => `Phiên bản ${v}`,
  // Trang chi tiết
  back: "Quay lại",
  logisticsTitle: "Logistics",
  policyTitle: "Chính sách tồn",
  saveLogistics: "Lưu logistics",
  savePolicy: "Lưu chính sách",
  saving: "Đang lưu…",
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
    all: "Tất cả",
  },
  validation: {
    mustBePositive: "Phải lớn hơn 0",
    integerAtLeast1: "Số nguyên ≥ 1",
    integerAtLeast0: "Số nguyên ≥ 0",
    uomFormat: "Đơn vị tính 1–16 ký tự in hoa, số hoặc _",
    barcodeMax: "Mã vạch tối đa 64 ký tự",
    noteMax: "Ghi chú tối đa 500 ký tự",
    safetyAboveReorder: "Tồn an toàn không được lớn hơn điểm đặt lại",
    shelfLifeRange: (lo: number, hi: number) => `Số nguyên từ ${lo} đến ${hi}`,
  },
  yes: "Có",
  no: "Không",
  dimensions: "Kích thước",
  packageDimensions: "Kiện giao",
  countAndPack: "Số kiện / đơn vị · Quy cách",
  packSuffix: "/gói",
  evaluation: {
    yes: "Có",
    no: "Không",
    unset: "Chưa đặt ngưỡng",
  },
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
  policySaved: "Đã lưu chính sách tồn",
} as const;

/** BE `errorCode` của hồ sơ hàng tồn (BE PR #119) → câu tiếng Việt; message BE là tiếng Anh. */
export const INVENTORY_ITEM_ERROR_MESSAGES = {
  INVENTORY_ITEM_NOT_FOUND: "Không tìm thấy hồ sơ hàng tồn này — có thể SKU đã bị xoá.",
  OPTIMISTIC_LOCK: "Hồ sơ vừa được người khác sửa. Dữ liệu đã được tải lại, hãy nhập lại.",
  INVENTORY_POLICY_INVALID:
    "Chính sách tồn chưa hợp lệ — kiểm tra lại các ngưỡng, cách xuất kho và hạn dùng.",
  INVENTORY_MAX_QTY_BELOW_THRESHOLD: "Tồn tối đa phải ≥ điểm đặt lại và ≥ tồn an toàn.",
  /** VALIDATION_FAILED trên maxQty (bean validation @Min(0)). */
  MAX_QTY_NEGATIVE: "Tồn tối đa phải là số nguyên ≥ 0.",
  /** INVENTORY_POLICY_STOCK_CONFLICT khi lưu logistics = đổi ĐVT lúc còn tồn. */
  UOM_STOCK_CONFLICT:
    "Không đổi được đơn vị tính khi SKU còn tồn kho — mọi số lượng đã đếm đang theo đơn vị cũ.",
  INVENTORY_POLICY_STOCK_CONFLICT:
    "SKU đang có tồn hoặc lô hàng nên chưa đổi được cách theo dõi / xuất kho / hạn dùng theo hướng này.",
  COUNT_POLICY_CONFLICT:
    "Đang có đợt kiểm kê SKU này — chưa đổi được cách xuất kho / theo dõi / hạn dùng.",
  CONFLICT: "Mã vạch này đã được dùng cho SKU khác.",
  /** BE #121 InventoryItemsImpl: SKU ngừng dùng thì hồ sơ chỉ còn đọc, sửa logistics / chính sách là 409. */
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
