/**
 * Bảng giá riêng của khách hàng (BE `CustomerPriceController`, `CustomerPrice`, `SellingPrice`;
 * docs/handoffs/SPRINT2-PRICING-PLAN.md P3). Giá áp dụng tới khi sửa — KHÔNG có ngày hiệu lực;
 * MOQ là `minQuantity` nhỏ nhất, không nhập riêng; tiền tệ luôn VND.
 */

import { CUSTOMER_PRICE_LIMITS as L } from "./numbers";

export const CUSTOMER_PRICE_FIELD_MESSAGES = {
  tiersCount: `Cần từ 1 đến ${L.tiersMax} bậc giá`,
  minQuantity: `Số lượng từ là số nguyên từ ${L.minQuantityMin} trở lên`,
  // BE `CustomerPrice`: "Two price tiers start at N"
  minQuantityDuplicate: "Hai bậc giá không được bắt đầu cùng một số lượng",
  // BE `SellingPrice`: > 0, VND số nguyên, tối đa 16 chữ số phần nguyên
  unitPrice: `Đơn giá là số tiền VND nguyên lớn hơn 0, tối đa ${L.priceIntegerDigitsMax} chữ số`,
  // Giá JSON đi qua số thực IEEE-754 của trình duyệt — quá nhiều chữ số thì không gửi nguyên vẹn được
  unitPricePrecision: "Đơn giá có quá nhiều chữ số để gửi chính xác — hãy bớt chữ số",
  note: `Ghi chú tối đa ${L.noteMax} ký tự`,
  version: "Thiếu phiên bản dữ liệu — tải lại bảng giá rồi lưu lại",
} as const;

/** Theo `errorCode` của BE (BE trả message tiếng Anh). */
export const CUSTOMER_PRICE_ERROR_MESSAGES = {
  VALIDATION_FAILED: "Dữ liệu bảng giá không hợp lệ — kiểm tra lại các bậc giá.",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng này.",
  CUSTOMER_PRICE_NOT_FOUND: "Khách hàng chưa có giá riêng cho SKU này (có thể vừa bị xoá).",
  VARIANT_NOT_FOUND: "Không tìm thấy SKU này trong danh mục sản phẩm.",
  // POST khi khách đã có giá cho SKU (BE `CustomerPriceService.create`)
  CONFLICT: "Khách hàng đã có giá riêng cho SKU này — mở để sửa thay vì tạo mới.",
  OPTIMISTIC_LOCK:
    "Bảng giá vừa được người khác thay đổi. Tải lại dữ liệu mới nhất trước khi lưu (thay đổi chưa lưu sẽ mất).",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này với bảng giá khách hàng.",
  unexpected: "Không thực hiện được thao tác với bảng giá. Vui lòng thử lại.",
} as const;

/** Nhãn dùng chung cho các màn bảng giá khách hàng (màn hình làm ở bước sau). */
export const CUSTOMER_PRICE_UI_LABELS = {
  title: "Bảng giá khách hàng",
  field: {
    customer: "Khách hàng",
    sku: "SKU",
    moq: "SL đặt tối thiểu (MOQ)",
    tiers: "Bậc giá",
    minQuantity: "Từ số lượng",
    unitPrice: "Đơn giá (VND)",
    note: "Ghi chú",
  },
  // MOQ suy từ bậc giá thấp nhất; dưới MOQ khách không có giá (BE `CustomerPrice.priceFor`)
  moqHint:
    "MOQ là số lượng của bậc giá thấp nhất — dưới mức này khách không đặt được theo giá riêng.",
  noValidity: "Giá riêng áp dụng tới khi được sửa, không có ngày hiệu lực.",
  // Giá BE trả về vượt độ chính xác số của trình duyệt (> 9.007.199.254.740.991)
  priceInexact: "Đơn giá vượt độ chính xác hiển thị của trình duyệt — không sửa bậc này ở đây.",
  navLabel: "Bảng giá khách hàng",
  picker: {
    label: "Khách hàng",
    placeholder: "Chọn khách hàng…",
    search: "Tìm theo tên, email hoặc số điện thoại…",
    loading: "Đang tìm khách hàng…",
    failed: "Không tải được danh sách khách hàng.",
    empty: "Không có khách hàng phù hợp.",
    retry: "Thử lại",
    previous: "Trang trước",
    next: "Trang sau",
    pageInfo: (page: number, total: number) => `Trang ${page} — ${total} khách`,
  },
  customer: {
    clear: "Bỏ chọn khách",
    loading: "Đang tải thông tin khách hàng…",
    failed: "Không tải được thông tin khách hàng.",
    notFound: "Không tìm thấy khách hàng này.",
    // Thiếu `customer-customers:READ`: chỉ có id từ đường dẫn
    noLookupPermission:
      "Bạn không có quyền xem danh sách khách hàng — chỉ hiện mã định danh, không tải được tên.",
    noSelection: "Chọn một khách hàng để xem bảng giá riêng.",
    noSelectionRestricted:
      "Bạn không có quyền tra cứu khách hàng. Mở trang bằng đường dẫn có sẵn mã khách (customerId) để xem bảng giá.",
    invalidId: "Mã khách hàng trong đường dẫn không hợp lệ.",
    // BE nhận bảng giá cho mọi trạng thái — chỉ cảnh báo, không chặn
    statusWarning:
      "Khách hàng đang ngừng hoạt động hoặc bị khoá — giá riêng vẫn được lưu nhưng khách có thể không đặt hàng được.",
  },
  table: {
    caption: "Giá riêng theo SKU của khách hàng",
    filter: "Lọc theo SKU…",
    tierCount: "Số bậc",
    lowest: "Giá thấp nhất",
    highest: "Giá cao nhất",
    inexactCell: "Không chính xác",
    loading: "Đang tải bảng giá…",
    noPrices: "Khách hàng này chưa có giá riêng nào.",
    noPricesHint: "Khách đang mua theo giá nhóm hoặc giá cơ sở của sản phẩm.",
    noMatch: "Không có SKU nào khớp bộ lọc.",
    clearFilter: "Bỏ lọc",
    readDenied: "Bạn không có quyền xem bảng giá khách hàng.",
    loadFailed: "Không tải được bảng giá của khách hàng. Vui lòng thử lại.",
    retry: "Thử lại",
    refreshFailed: "Không làm mới được bảng giá — đang hiện dữ liệu đã tải trước đó.",
  },
  form: {
    create: "Thêm bảng giá",
    edit: "Sửa bảng giá",
    editRow: (sku: string) => `Sửa bảng giá ${sku}`,
    createTitle: "Thêm bảng giá cho khách",
    editTitle: (sku: string) => `Sửa bảng giá ${sku}`,
    description:
      "Mỗi bậc là đơn giá áp dụng khi đặt từ số lượng đó trở lên. Giá áp dụng tới khi sửa.",
    customerLine: (customer: string) => `Khách hàng: ${customer}`,
    save: "Lưu bảng giá",
    saving: "Đang lưu…",
    saved: "Đã lưu bảng giá khách hàng",
    sku: "SKU",
    skuHint: "Nhập mã SKU (không phân biệt hoa thường) — SKU phải có trong danh mục sản phẩm.",
    skuInvalid: "Mã SKU không đúng định dạng (chữ, số, dấu . _ -; tối đa 64 ký tự)",
    skuLocked: "SKU là định danh của bảng giá — không đổi được khi sửa.",
    moqHint: "MOQ được xác định bởi mức số lượng nhỏ nhất.",
    tierOrderHint: "Có thể nhập các bậc theo thứ tự bất kỳ — hệ thống tự sắp theo số lượng.",
    addTier: "Thêm bậc giá",
    removeTier: (index: number) => `Xoá bậc giá ${index}`,
    tierLabel: (index: number) => `Bậc ${index}`,
    tierLimit: "Tối đa 20 bậc giá.",
    // Đơn giá VND nguyên: "95.000" của người dùng VN là 95 nghìn — chỉ nhận chữ số để không lưu nhầm 95 đ
    digitsOnly: "Đơn giá chỉ gồm chữ số, không dùng dấu chấm / phẩy (vd 95000)",
    inexactReplace: "Giá cũ không đọc chính xác được — nhập lại đơn giá cho bậc này",
    inexactWarning:
      "Có bậc giá vượt độ chính xác của trình duyệt nên không đọc lại đúng được. Ô giá của bậc đó để trống — nhập giá mới trước khi lưu.",
    loading: "Đang tải bảng giá…",
    loadFailed: "Không tải được bảng giá để sửa.",
    conflictOpenExisting: (sku: string) => `Mở bảng giá hiện có của ${sku}`,
    // 409 CONFLICT khi thiếu quyền đọc / sửa bảng giá: không có lối mở bản có sẵn, bản nháp giữ nguyên
    conflictNoAccess:
      "Bạn không có quyền xem và sửa bảng giá hiện có — đổi sang SKU khác hoặc nhờ người có quyền sửa bảng giá này.",
    openExistingTitle: (sku: string) => `Bỏ bản nháp và mở bảng giá ${sku}?`,
    openExistingDescription: (sku: string) =>
      `Bản nháp tạo mới sẽ bị bỏ, không hoàn tác được. Bảng giá hiện có của SKU ${sku} sẽ được mở để sửa (tải lại từ hệ thống).`,
    openExistingConfirm: "Bỏ bản nháp và mở",
    outdated: "Bảng giá vừa được cập nhật ở nơi khác. Bản đang sửa vẫn dựa trên dữ liệu cũ.",
    reload: "Tải dữ liệu mới nhất",
    reloadWarning: "Tải lại sẽ bỏ mọi thay đổi chưa lưu.",
    reloading: "Đang tải dữ liệu mới nhất…",
    // GET lỗi (cả khi còn bản cũ trong cache): bản nháp + version giữ nguyên, bấm lại để thử
    reloadFailed:
      "Không tải được dữ liệu mới nhất — bản nháp và phiên bản đang sửa vẫn giữ nguyên. Bấm “Tải dữ liệu mới nhất” để thử lại.",
    refreshFailed: "Không làm mới được bảng giá — bản nháp vẫn giữ nguyên.",
    discardTitle: "Bỏ thay đổi chưa lưu?",
    discardDescription: "Bản nháp bảng giá sẽ mất. Hành động này không hoàn tác được.",
    discard: "Bỏ bản nháp",
    keepEditing: "Tiếp tục sửa",
    // Khách trên URL đổi (Back / Forward) khi form đang có thay đổi chưa lưu
    customerChanged: (customer: string) =>
      `Khách đang chọn đã đổi. Bản nháp này thuộc khách ${customer} nên không lưu được ở đây.`,
    returnToCustomer: "Quay lại khách đó",
  },
  detail: {
    tierHeading: "Bậc giá theo số lượng",
    // Mỗi bậc: đơn giá áp dụng từ số lượng tối thiểu đó (không phải lịch theo ngày)
    tierHint: "Mỗi dòng là đơn giá áp dụng khi đặt từ số lượng đó trở lên.",
    tierLine: (minQuantity: string) => `Từ ${minQuantity} đơn vị`,
    perUnit: "/ đơn vị",
    noNote: "Không có ghi chú",
    version: "Phiên bản",
  },
} as const;
