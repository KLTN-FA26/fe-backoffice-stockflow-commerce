/**
 * Nhãn, thông báo và lỗi của danh mục hàng NCC (docs 02 §4 bước 5; BE `SupplierItemController`,
 * `SupplierItemTerms`, `messages_vi.properties` mục `error.SUPPLIER_ITEM_*`).
 * Tách khỏi `labels.ts` cho gọn, theo mẫu `labels-transfer.ts`.
 */

import { SUPPLIER_ITEM_LIMITS } from "./numbers";

export const SUPPLIER_ITEM_UI_LABELS = {
  tabTitle: "Danh mục hàng",
  listCaption: "mặt hàng của nhà cung cấp",
  field: {
    sku: "SKU",
    supplierSkuCode: "Mã SKU của NCC",
    price: "Giá",
    moq: "SL đặt tối thiểu (MOQ)",
    packSize: "Quy cách đóng gói",
    leadTimeDays: "Thời gian giao (ngày)",
    preferred: "NCC ưu tiên",
  },
  hint: {
    supplierSkuCode: "Mã NCC dùng để gọi mặt hàng này, bỏ trống nếu trùng SKU.",
    moq: "Phải là bội số của quy cách đóng gói.",
    leadTimeDays: "Bỏ trống để dùng thời gian giao mặc định của nhà cung cấp.",
    // Khác issue #30 (BE #121): "ưu tiên" = NCC mặc định của hồ sơ hàng tồn (docs 01 §3)
    preferred: "Đặt làm nhà cung cấp mặc định của SKU này.",
    // BE `SupplierItemServiceImpl`: preferred=true đè NCC mặc định cũ; bỏ tick trên dòng đang ưu tiên
    // thì xoá NCC mặc định của SKU (`clearDefaultSupplier`)
    preferredMoves:
      "Nếu SKU đang có nhà cung cấp mặc định khác, ưu tiên sẽ chuyển sang nhà cung cấp này.",
    preferredClears:
      "Bỏ ưu tiên sẽ xoá nhà cung cấp mặc định của SKU — SKU sẽ không còn NCC mặc định.",
    price: "Giá tính theo tiền tệ của nhà cung cấp.",
  },
  // Ô chọn SKU theo hồ sơ hàng tồn (BE `GET /inventory/items?q=`) khi thêm mặt hàng
  skuPicker: {
    placeholder: "Chọn SKU từ hồ sơ hàng tồn",
    search: "Tìm theo SKU hoặc mã vạch",
    loading: "Đang tìm hồ sơ hàng tồn…",
    empty: "Không có SKU phù hợp chưa nằm trong danh mục",
    // Chỉ lấy trang đầu kết quả (INVENTORY_ITEM_OPTIONS_PAGE_SIZE) — còn nữa thì nhắc gõ thêm
    moreResults: "Còn nhiều kết quả khác — gõ thêm SKU hoặc mã vạch để thu hẹp.",
    emptyButMore:
      "Các kết quả đầu đều đã có trong danh mục — gõ thêm SKU hoặc mã vạch để tìm SKU khác.",
    loadFailed: "Không tải được hồ sơ hàng tồn.",
    retry: "Thử lại",
    barcode: (code: string) => `Mã vạch ${code}`,
    manualNotice:
      "Bạn không có quyền xem hồ sơ hàng tồn — hãy gõ đúng SKU, hệ thống kiểm tra khi lưu.",
    // Danh mục NCC dài hơn trang tối đa BE (200 dòng): không ẩn được hết SKU đã có
    // Không tải được danh mục đủ 200 dòng cho ô chọn → không ẩn được SKU đã có
    catalogFailedNotice:
      "Không tải được danh mục của NCC — SKU đã có có thể vẫn hiện, hệ thống báo trùng khi lưu.",
    truncatedNotice:
      "Danh mục của NCC dài hơn 200 dòng — SKU đã có có thể vẫn hiện, hệ thống báo trùng khi lưu.",
  },
  action: {
    add: "Thêm SKU",
    addFirst: "Thêm SKU đầu tiên",
    firstPage: "Về trang đầu",
    edit: "Sửa",
    delete: "Xoá",
    save: "Lưu",
  },
  addTitle: "Thêm mặt hàng vào danh mục",
  editTitle: "Sửa mặt hàng trong danh mục",
  deleteTitle: "Xoá mặt hàng khỏi danh mục",
  deleteDescription: (sku: string) =>
    `Xoá SKU ${sku} khỏi danh mục của nhà cung cấp này? Có thể thêm lại sau.`,
  // BE SupplierItemServiceImpl#delete: xoá dòng KHÔNG gỡ NCC mặc định của hồ sơ hàng tồn (master data)
  deletePreferredWarning:
    "Dòng này đang là NCC ưu tiên: xoá khỏi danh mục KHÔNG gỡ NCC mặc định của SKU. Muốn gỡ, hãy bỏ chọn “Ưu tiên” trước khi xoá.",
  empty: "NCC chưa có SKU nào",
  invalidPageTitle: "Trang không còn dữ liệu",
  invalidPageDescription: "Trang hiện tại vượt quá số trang của danh mục.",
  emptyDescription:
    "Danh mục cho biết SKU nào được đặt từ nhà cung cấp này, với giá và MOQ ra sao.",
  // BE `GET /suppliers/{id}/items` không có tham số tìm kiếm — chỉ sắp xếp và phân trang
  tabProfile: "Hồ sơ",
  tabsAria: "Thông tin nhà cung cấp",
  column: {
    sku: "SKU",
    supplierSkuCode: "Mã của NCC",
    price: "Đơn giá",
    moq: "MOQ",
    packSize: "Quy cách",
    leadTime: "Lead time",
    preferred: "Ưu tiên",
    actions: "Thao tác",
  },
  days: (n: number) => `${n} ngày`,
  // `leadTimeDays` null → BE dùng lead time mặc định của NCC (`effectiveLeadTimeDays`)
  supplierDefaultDays: (n: number) => `Theo NCC (${n} ngày)`,
  preferredBadge: "Ưu tiên",
  editAria: (sku: string) => `Sửa ${sku}`,
  deleteAria: (sku: string) => `Xoá ${sku}`,
  addDescription: "SKU phải đã có hồ sơ hàng tồn. Giá tính theo tiền tệ của nhà cung cấp.",
  editDescription: (sku: string) => `Cập nhật điều khoản mua SKU ${sku}. SKU không đổi được.`,
  caption: (shown: number, total: number) => `Hiển thị ${shown} / ${total} SKU`,
  refetching: "Đang tải lại danh mục hàng",
  inactiveNotice:
    "Nhà cung cấp không còn hoạt động — chỉ được xem và xoá mặt hàng, không thêm hoặc sửa.",
  loadFailed: "Không tải được danh mục hàng của nhà cung cấp.",
  forbiddenDescription: "Bạn không có quyền xem danh mục hàng của nhà cung cấp này.",
} as const;

export const SUPPLIER_ITEM_TOAST_MESSAGES = {
  created: "Đã thêm mặt hàng vào danh mục",
  updated: "Đã cập nhật mặt hàng trong danh mục",
  deleted: "Đã xoá mặt hàng khỏi danh mục",
} as const;

/** Câu cho từng ô khi BE trả 400 theo tên field (ApiError chỉ giữ message, không giữ code field). */
export const SUPPLIER_ITEM_FIELD_MESSAGES = {
  sku: "Mã SKU không đúng định dạng",
  supplierSkuCode: `Mã SKU của nhà cung cấp tối đa ${SUPPLIER_ITEM_LIMITS.supplierSkuCodeMax} ký tự`,
  price:
    "Giá phải lớn hơn 0 và không có nhiều chữ số thập phân hơn mức tiền tệ của nhà cung cấp cho phép",
  moq: "Số lượng đặt tối thiểu phải từ 1 trở lên và là bội số của quy cách đóng gói",
  packSize: "Quy cách đóng gói phải từ 1 trở lên",
  leadTimeDays: `Thời gian giao phải từ 0 đến ${SUPPLIER_ITEM_LIMITS.leadTimeDaysMax} ngày`,
} as const;

/** Theo `errorCode` của BE (dịch từ `messages_vi.properties`). */
export const SUPPLIER_ITEM_ERROR_MESSAGES = {
  SUPPLIER_ITEM_SKU_INVALID: SUPPLIER_ITEM_FIELD_MESSAGES.sku,
  SUPPLIER_ITEM_SUPPLIER_SKU_CODE_TOO_LONG: SUPPLIER_ITEM_FIELD_MESSAGES.supplierSkuCode,
  SUPPLIER_ITEM_PRICE_INVALID: SUPPLIER_ITEM_FIELD_MESSAGES.price,
  SUPPLIER_ITEM_MOQ_INVALID: "Số lượng đặt tối thiểu phải từ 1 trở lên",
  SUPPLIER_ITEM_PACK_SIZE_INVALID: SUPPLIER_ITEM_FIELD_MESSAGES.packSize,
  SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE:
    "Số lượng đặt tối thiểu phải là bội số của quy cách đóng gói",
  SUPPLIER_ITEM_LEAD_TIME_INVALID: SUPPLIER_ITEM_FIELD_MESSAGES.leadTimeDays,
  SUPPLIER_ITEM_NOT_FOUND: "Không tìm thấy mặt hàng của nhà cung cấp",
  SUPPLIER_ITEM_DUPLICATE: "Nhà cung cấp này đã có SKU này trong danh mục",
  SUPPLIER_INACTIVE: "Nhà cung cấp không còn hoạt động nên không thể thêm hoặc sửa mặt hàng",
  SKU_NOT_PURCHASABLE: "SKU này không còn được phép mua",
  INVENTORY_ITEM_NOT_FOUND: "Chưa có hồ sơ hàng tồn cho SKU này",
  SUPPLIER_ITEM_IN_USE:
    "Hãy đóng hoặc huỷ các đơn đặt hàng đang mở đặt SKU này từ nhà cung cấp này trước",
  OPTIMISTIC_LOCK: "Mặt hàng vừa được người khác thay đổi — hãy tải lại rồi thử lại",
  generic: "Không thực hiện được thao tác với danh mục hàng. Vui lòng thử lại.",
} as const;
