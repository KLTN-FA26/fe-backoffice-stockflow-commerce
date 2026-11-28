/**
 * Giá chuẩn theo quy cách (BE `StandardPriceController`, `StandardPrice`; kltn-docs 13 BR-04 sửa ngày 2026-11-26).
 * Quản lý kinh doanh giữ, cho mỗi quy cách của danh mục (ly trơn, không phải SKU riêng của khách), 1–20 bậc giá theo
 * thùng. Sales chỉ xem. Khách không bao giờ thấy. Một dòng báo giá chưa có bậc giá lấy giá riêng của khách, không có thì
 * lấy giá chuẩn của quy cách SKU được làm từ đó; báo giá thấp hơn giá tham chiếu quá ngưỡng phải chờ duyệt (14 BR-10).
 */

/** Theo `errorCode` của BE (BE trả message tiếng Việt; câu ở đây là dự phòng và để chọn ô báo lỗi). */
export const STANDARD_PRICE_ERROR_MESSAGES = {
  VALIDATION_FAILED: "Dữ liệu giá chuẩn không hợp lệ — kiểm tra lại các bậc giá.",
  STANDARD_PRICE_NOT_FOUND: "Quy cách này chưa có giá chuẩn (có thể vừa bị xoá).",
  VARIANT_NOT_FOUND: "Không tìm thấy quy cách (SKU) này trong danh mục sản phẩm.",
  // BE `StandardPriceService`: SKU riêng của khách được định giá bằng giá riêng của khách
  STANDARD_PRICE_VARIANT_REQUIRED:
    "Giá chuẩn đặt cho quy cách của danh mục, không đặt cho SKU riêng của khách.",
  // POST khi quy cách đã có giá chuẩn
  CONFLICT: "Quy cách này đã có giá chuẩn — mở để sửa thay vì tạo mới.",
  OPTIMISTIC_LOCK:
    "Giá chuẩn vừa được người khác thay đổi. Tải lại dữ liệu mới nhất trước khi lưu (thay đổi chưa lưu sẽ mất).",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này với giá chuẩn.",
  unexpected: "Không thực hiện được thao tác với giá chuẩn. Vui lòng thử lại.",
} as const;

export const STANDARD_PRICE_UI_LABELS = {
  title: "Giá chuẩn",
  navLabel: "Giá chuẩn",
  intro:
    "Giá chuẩn của từng quy cách cho mẫu in thông thường. Báo giá dùng giá riêng của khách, không có thì dùng giá chuẩn; giá thấp hơn giá tham chiếu quá ngưỡng phải chờ Quản lý kinh doanh duyệt. Khách hàng không thấy giá chuẩn.",
  field: {
    sku: "SKU quy cách",
    product: "Sản phẩm",
    variant: "Quy cách",
    tiers: "Bậc giá",
    moq: "Từ (thùng)",
    note: "Ghi chú",
  },
  table: {
    caption: "Giá chuẩn theo quy cách",
    filter: "Lọc theo SKU, sản phẩm hoặc quy cách…",
    loading: "Đang tải giá chuẩn…",
    empty: "Chưa có quy cách nào có giá chuẩn.",
    emptyHint:
      "Quy cách chưa có giá chuẩn: báo giá của SKU làm từ quy cách đó (khi khách chưa có giá riêng) luôn chờ duyệt giá.",
    noMatch: "Không có giá chuẩn nào khớp bộ lọc.",
    clearFilter: "Bỏ lọc",
    readDenied: "Bạn không có quyền xem giá chuẩn.",
    loadFailed: "Không tải được giá chuẩn. Vui lòng thử lại.",
    retry: "Thử lại",
    refreshFailed: "Không làm mới được giá chuẩn — đang hiện dữ liệu đã tải trước đó.",
    tierLine: (minQuantity: string, price: string) => `Từ ${minQuantity} thùng: ${price}/cái`,
    unnamed: "—",
  },
  /** Thanh tìm + cấu hình kiểu Vercel và lọc header cột (backoffice-erp-ui A). */
  toolbar: {
    createTooltip: "Thêm giá chuẩn cho quy cách",
    createDenied: "Bạn không có quyền thêm giá chuẩn.",
    searchSummary: "Tìm kiếm chính",
    columnSearch: "Tìm trong cột",
    skuFilter: "Tìm theo SKU quy cách…",
    productFilter: "Tìm theo tên sản phẩm…",
    variantFilter: "Tìm theo quy cách…",
    /** Lọc cột Bậc giá: dòng có ít nhất một bậc có đơn giá trong khoảng. */
    priceFilterLabel: "đơn giá (có bậc trong khoảng)",
    columnSummary: (sku: string, product: string) =>
      [sku && `SKU “${sku}”`, product && `Sản phẩm “${product}”`].filter(Boolean).join(", "),
  },
  form: {
    create: "Thêm giá chuẩn",
    createTitle: "Thêm giá chuẩn cho quy cách",
    editTitle: (sku: string) => `Sửa giá chuẩn ${sku}`,
    editRow: (sku: string) => `Sửa giá chuẩn ${sku}`,
    description:
      "Mỗi bậc là đơn giá một cái cho mẫu in thông thường, áp dụng khi đặt từ số thùng đó trở lên.",
    save: "Lưu giá chuẩn",
    saving: "Đang lưu…",
    saved: "Đã lưu giá chuẩn",
    loading: "Đang tải giá chuẩn…",
    loadFailed: "Không tải được giá chuẩn để sửa.",
    skuLocked: "SKU là định danh của giá chuẩn — không đổi được khi sửa.",
    reload: "Tải dữ liệu mới nhất",
    reloading: "Đang tải dữ liệu mới nhất…",
    reloadWarning: "Tải lại sẽ bỏ mọi thay đổi chưa lưu.",
    reloadFailed: "Không tải được dữ liệu mới nhất — bản nháp vẫn giữ nguyên.",
    inexactWarning:
      "Có bậc giá vượt độ chính xác của trình duyệt nên không đọc lại đúng được. Ô giá của bậc đó để trống — nhập giá mới trước khi lưu.",
  },
  picker: {
    product: "Sản phẩm",
    productPlaceholder: "Chọn sản phẩm…",
    productSearch: "Tìm sản phẩm theo tên hoặc mã…",
    productLoading: "Đang tìm sản phẩm…",
    productFailed: "Không tải được danh sách sản phẩm.",
    productEmpty: "Không có sản phẩm phù hợp.",
    variant: "Quy cách",
    variantPlaceholder: "Chọn quy cách…",
    variantLoading: "Đang tải quy cách…",
    variantFailed: "Không tải được quy cách của sản phẩm.",
    // Quy cách của danh mục: bỏ SKU riêng của khách, quy cách đã ngừng và quy cách đã có giá chuẩn
    variantEmpty: "Sản phẩm này không còn quy cách nào chưa có giá chuẩn.",
    variantPriced: "đã có giá chuẩn",
    manualSku: "Hoặc nhập SKU quy cách",
    manualHint:
      "Chỉ quy cách của danh mục (ly trơn), không phải SKU riêng của khách — không phân biệt hoa thường.",
  },
  remove: {
    action: (sku: string) => `Xoá giá chuẩn ${sku}`,
    title: (sku: string) => `Xoá giá chuẩn của ${sku}?`,
    description:
      "Báo giá sau đó của SKU làm từ quy cách này (khi khách chưa có giá riêng) sẽ không còn giá tham chiếu và luôn chờ duyệt giá. Không hoàn tác được.",
    confirm: "Xoá giá chuẩn",
    deleted: "Đã xoá giá chuẩn",
  },
} as const;
