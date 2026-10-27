/**
 * Thông báo kiểm tra thông tin mua hàng của SKU (docs 01 §3 "Thông tin mua hàng"; BE
 * `SkuPurchasingRequest`, `ItemPurchasingRules`) và nhãn mục "Thông tin mua hàng" ở panel biến thể.
 */

import { SKU_PURCHASING_LIMITS } from "./numbers";

export const SKU_PURCHASING_FIELD_MESSAGES = {
  version: "Thiếu phiên bản dữ liệu — tải lại thông tin mua hàng rồi lưu lại",
  defaultSupplierId: "Nhà cung cấp mặc định không hợp lệ",
  referencePurchasePrice: `Giá mua tham khảo phải lớn hơn 0, tối đa ${SKU_PURCHASING_LIMITS.priceIntegerDigitsMax} chữ số phần nguyên và ${SKU_PURCHASING_LIMITS.priceMaxScale} chữ số thập phân`,
  // Giá JSON đi qua số thực IEEE-754 của trình duyệt — giá có quá nhiều chữ số không gửi nguyên vẹn được
  // Luật nhập liệu của form (không phải luật BE): "150.000" / "150,000" mơ hồ giữa 150 và 150000
  referencePurchasePriceGrouped: (suggestion: string | null) =>
    suggestion === null
      ? "Không dùng dấu phân cách hàng nghìn — nhập liền chữ số, vd 150000."
      : `Không dùng dấu phân cách hàng nghìn. Hãy nhập ${suggestion}.`,
  referencePurchasePriceComma: "Dùng dấu chấm cho phần thập phân (vd 12.5), không dùng dấu phẩy.",
  referencePurchasePricePrecision:
    "Giá mua tham khảo có quá nhiều chữ số để gửi chính xác — hãy bớt chữ số",
  referencePurchaseCurrency: "Tiền tệ là mã ISO 4217 gồm 3 chữ cái in hoa (vd VND)",
  // BE: giá và tiền tệ cùng có hoặc cùng trống — báo ở ô còn thiếu
  pricePairing: "Giá mua tham khảo và tiền tệ phải nhập cùng nhau",
  leadTimeDays: `Thời gian giao phải là số nguyên từ 0 đến ${SKU_PURCHASING_LIMITS.leadTimeDaysMax} ngày`,
  moq: `Số lượng đặt tối thiểu phải là số nguyên từ ${SKU_PURCHASING_LIMITS.moqMin} trở lên`,
} as const;

/**
 * Mục chỉ đọc ở panel biến thể. Giá / thời gian giao / MOQ của SKU là giá trị THAM KHẢO; PO dùng điều
 * khoản trong danh mục của NCC (BE `ProcurementServiceImpl` đọc MOQ + quy cách từ dòng danh mục).
 */
export const SKU_PURCHASING_UI_LABELS = {
  title: "Thông tin mua hàng",
  referenceTitle: "Thiết lập tham chiếu của SKU",
  referenceHint:
    "Giá trị tham khảo của SKU. Đơn đặt hàng dùng điều khoản trong danh mục của nhà cung cấp.",
  supplierTermsTitle: "Điều khoản của nhà cung cấp",
  supplierTermsHint: "Theo danh mục hàng của nhà cung cấp mặc định — áp dụng khi lập đơn đặt hàng.",
  notSet: "Chưa thiết lập",
  loading: "Đang tải thông tin mua hàng…",
  noPermission: "Bạn không có quyền xem thông tin mua hàng của SKU.",
  retry: "Thử lại",
  field: {
    defaultSupplier: "Nhà cung cấp mặc định",
    referencePrice: "Giá mua tham khảo",
    currency: "Tiền tệ",
    leadTimeDays: "Thời gian giao tham khảo",
    moq: "SL đặt tối thiểu tham khảo",
    supplierSkuCode: "Mã SKU của NCC",
    supplierMoq: "SL đặt tối thiểu (MOQ)",
    packSize: "Bội số đặt hàng (quy cách)",
    effectiveLeadTime: "Thời gian giao hiệu lực",
  },
  days: (days: number) => `${days} ngày`,
  supplier: {
    name: (code: string, name: string) => `${code} — ${name}`,
    loading: "Đang tải nhà cung cấp…",
    // Thiếu `procurement-supplier-items:READ`: chỉ có id từ thông tin mua hàng
    noPermission: "Không có quyền xem danh mục nhà cung cấp — chỉ hiện mã định danh.",
    loadFailed: "Không tải được thông tin nhà cung cấp.",
    // BE: xoá dòng danh mục của NCC mặc định không xoá NCC mặc định của SKU
    notListed: "Nhà cung cấp này không còn trong danh mục hàng của SKU.",
    inactive: "Nhà cung cấp không còn hoạt động.",
  },
  // Panel còn nút "Sửa" của biến thể — tên nút phải nói rõ sửa gì
  edit: "Sửa thông tin mua hàng",
  save: "Lưu thông tin mua hàng",
  saving: "Đang lưu…",
  cancel: "Huỷ",
  saved: "Đã lưu thông tin mua hàng",
  form: {
    noSupplier: "Không có nhà cung cấp mặc định",
    supplierHint: "Chỉ chọn được nhà cung cấp đang hoạt động và có trong danh mục hàng của SKU.",
    // Giữ nguyên NCC mặc định hiện có (BE không kiểm lại NCC khi không đổi)
    currentInactive: (label: string) => `${label} — không còn hoạt động (giữ nguyên)`,
    currentNotListed: (id: string) => `${id} — không có trong danh mục (giữ nguyên)`,
    inactiveOption: (label: string) => `${label} — không còn hoạt động`,
    // Ô NCC chỉ đọc: thiếu quyền / chưa tải được danh mục → lưu giữ nguyên NCC mặc định hiện có
    supplierLocked: "Nhà cung cấp mặc định được giữ nguyên khi lưu.",
    priceHint:
      "Nhập liền chữ số, không dấu phân cách hàng nghìn (vd 150000); phần thập phân dùng dấu chấm, tối đa 2 chữ số (vd 12.5). Để trống cả giá và tiền tệ nếu không có giá tham khảo.",
    currencyHint: "Mã ISO 4217, vd VND, USD.",
    leadTimeHint: "0 = giao ngay; để trống nếu chưa thiết lập.",
    outdated:
      "Thông tin mua hàng vừa được cập nhật ở nơi khác. Bản đang sửa vẫn dựa trên dữ liệu cũ.",
    reload: "Tải dữ liệu mới nhất",
    reloadWarning: "Tải lại sẽ bỏ mọi thay đổi chưa lưu.",
    reloading: "Đang tải dữ liệu mới nhất…",
    // GET lỗi (cả khi còn bản cũ trong cache): bản nháp + version giữ nguyên, bấm lại để thử
    reloadFailed:
      "Không tải được dữ liệu mới nhất — bản nháp và phiên bản đang sửa vẫn giữ nguyên. Bấm “Tải dữ liệu mới nhất” để thử lại.",
  },
  saveError: {
    versionConflict:
      "SKU vừa được thay đổi ở nơi khác (thông tin mua hàng, logistics, chính sách tồn hoặc nhà cung cấp ưu tiên). Chưa lưu gì.",
    productLocked:
      "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh — không sửa được thông tin mua hàng.",
    variantObsolete: "Biến thể đã ngừng — thông tin mua hàng được giữ nguyên.",
    SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp này.",
    SUPPLIER_INACTIVE: "Nhà cung cấp không còn hoạt động — không đặt làm mặc định được.",
    forbidden: "Bạn không có quyền sửa thông tin mua hàng.",
    malformed: "Dữ liệu gửi đi không đúng định dạng.",
    invalid: "Dữ liệu không hợp lệ — kiểm tra lại các ô.",
    unexpected: "Không lưu được thông tin mua hàng. Vui lòng thử lại.",
  },
  error: {
    forbidden: "Bạn không có quyền xem thông tin mua hàng của SKU.",
    // BE `ItemPurchasingServiceImpl.purchasing`: 404 INVENTORY_ITEM_NOT_FOUND
    noInventoryItem: "SKU chưa có hồ sơ hàng tồn nên chưa có thông tin mua hàng.",
    notFound: "Không tìm thấy sản phẩm hoặc biến thể.",
    loadFailed: "Không tải được thông tin mua hàng. Vui lòng thử lại.",
  },
} as const;
