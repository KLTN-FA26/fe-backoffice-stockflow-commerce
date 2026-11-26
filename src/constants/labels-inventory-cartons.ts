/**
 * Màn Thùng hàng (LPN) — tra cứu mọi thùng theo kho / SKU / vị trí / lô / LPN / trạng thái (docs 20 §4.1; BE
 * `GET /inventory/stock-packages`, issue #454). Tách khỏi `inventory.ts` cho gọn.
 */

import type { CARTON_LIST_COLUMNS } from "./table";

type CartonColumn = (typeof CARTON_LIST_COLUMNS)[keyof typeof CARTON_LIST_COLUMNS];

/** Thùng đến từ đâu — BE `StockPackageResponse.source` (chuỗi mở: giá trị lạ hiện nguyên văn). */
export const CARTON_SOURCES = ["GOODS_RECEIPT", "PRODUCTION", "RETURN", "IN_WAREHOUSE"] as const;
export type CartonSource = (typeof CARTON_SOURCES)[number];

/** Việc đang làm trên thùng (docs 20 BR-10: thùng bận) — BE `StockPackageResponse.OpenTask.type`. */
export const CARTON_OPEN_TASK_TYPES = ["PUTAWAY", "PICK", "CARTON_CHECK", "CYCLE_COUNT"] as const;
export type CartonOpenTaskType = (typeof CARTON_OPEN_TASK_TYPES)[number];

/** Trạng thái thùng BE lọc được (`status`, lặp lại) — mặc định BE chỉ trả thùng còn sống (RECEIVING, IN_STOCK). */
export const CARTON_FILTER_STATUSES = [
  "RECEIVING",
  "IN_STOCK",
  "CONSUMED",
  "LOST",
  "VOID",
] as const;

/** Sắp xếp BE nhận (`SortWhitelist` của `StockPackageSearch`); `receivedAt` = nhập trước xếp trước (FIFO). */
export const CARTON_SORTS = ["lpn", "receivedAt", "locationCode", "sku"] as const;
export type CartonSort = (typeof CARTON_SORTS)[number];

/** BE từ chối `q` ngắn hơn 3 ký tự (400 VALIDATION_FAILED) — FE không gửi, chỉ nhắc. */
export const CARTON_SEARCH_MIN = 3;

const COLUMN: Record<CartonColumn, string> = {
  lpn: "LPN",
  product: "Sản phẩm",
  warehouse: "Kho",
  location: "Vị trí",
  lot: "Lô",
  qty: "Còn / Danh nghĩa",
  reserved: "Đang giữ",
  status: "Trạng thái thùng",
  stockStatus: "Trạng thái tồn",
  receivedAt: "Nhận lúc",
  source: "Nguồn",
  openTask: "Đang bận",
  actions: "Thao tác",
};

export const CARTON_LIST_LABELS = {
  title: "Thùng hàng (LPN)",
  searchPlaceholder: "Tìm theo một phần mã LPN (ít nhất 3 ký tự)…",
  searchTooShort: (min: number) => `Nhập ít nhất ${min} ký tự của mã LPN để tìm.`,
  column: COLUMN,
  /** Lọc khớp ĐÚNG mã (BE so bằng nhau, không phải "chứa") — nói rõ để người dùng không tưởng lọc hỏng. */
  exactFilter: (label: string) => `${label} — nhập đúng mã`,
  optionSearch: "Tìm…",
  optionEmpty: "Không có lựa chọn",
  all: "Tất cả",
  liveOnly: "Còn trong kho",
  sortLabel: "Sắp xếp",
  sort: {
    lpn: "Theo mã LPN",
    receivedAt: "Nhập trước xếp trước (FIFO)",
    locationCode: "Theo vị trí",
    sku: "Theo SKU",
  } satisfies Record<CartonSort, string>,
  source: {
    GOODS_RECEIPT: "Phiếu nhận",
    PRODUCTION: "Sản xuất nội bộ",
    RETURN: "Hàng hoàn",
    IN_WAREHOUSE: "Đóng tại kho",
  } satisfies Record<CartonSource, string>,
  openTask: {
    PUTAWAY: "Đang chờ cất",
    PICK: "Đang lấy hàng",
    CARTON_CHECK: "Đang kiểm thùng",
    CYCLE_COUNT: "Đang kiểm kê",
  } satisfies Record<CartonOpenTaskType, string>,
  heldFor: (orders: number) => `Giữ cho ${orders} đơn`,
  // Thanh Cấu hình
  summarySearch: "Search chính",
  summaryColumnSearch: "Search trong cột",
  summaryColumns: "Cột hiển thị",
  // Empty / lỗi
  emptyTitle: "Chưa có thùng nào",
  emptyDescription: "Thùng có LPN xuất hiện ở đây khi phiếu nhận ghi nhận hàng vào kho.",
  filteredTitle: "Không tìm thấy thùng",
  filteredDescription: "Không thùng nào khớp bộ lọc hiện tại.",
  clearFilters: "Bỏ bộ lọc",
  errorCopy: {
    pageTitle: "Thùng hàng (LPN)",
    notFoundTitle: "Không tìm thấy dữ liệu thùng",
    notFoundDescription: "Kho hoặc vị trí đang lọc không còn.",
    forbiddenDescription: "Bạn không có quyền xem thùng của kho hoặc vị trí này.",
    noReadDescription: "Bạn không có quyền xem danh sách thùng.",
  },
  /** Panel chi tiết (`?lpn=`): 404 = LPN không có, không phải "bộ lọc không còn" như danh sách. */
  detailErrorCopy: {
    pageTitle: "Thùng hàng (LPN)",
    notFoundTitle: "Không tìm thấy thùng",
    notFoundDescription: "Không có thùng nào mang mã LPN này — kiểm tra lại link hoặc mã.",
    forbiddenDescription: "Bạn không có quyền xem thùng này (thùng ở kho ngoài phạm vi của bạn).",
    noReadDescription: "Bạn không có quyền xem thùng.",
  },
  openDetail: (lpn: string) => `Xem chi tiết ${lpn}`,
  // Panel chi tiết
  detail: {
    general: "Thông tin chung",
    contents: "Hàng trong thùng",
    holds: "Đang giữ cho đơn",
    openTask: "Việc đang làm",
    history: "Lịch sử di chuyển",
    product: "Sản phẩm",
    variant: "Biến thể",
    sku: "SKU",
    unit: "Đơn vị đóng gói",
    nominal: "Danh nghĩa",
    received: "Đã nhận",
    onHand: "Còn",
    reserved: "Đang giữ",
    closedAt: "Đóng / hết lúc",
    receipt: "Phiếu nhận",
    returnRma: "Yêu cầu trả hàng",
    returnOwnership: "Hàng của",
    openedOnReturn: "Về bị mở / rỗng — không bán lại",
    order: "Đơn hàng",
    quantity: "Số cái",
    lot: "Lô",
    stockStatus: "Trạng thái tồn",
    occurredAt: "Lúc",
    movementType: "Loại",
    fromTo: "Từ → Đến",
    actor: "Người làm",
    noContents: "Thùng không còn hàng.",
    noHolds: "Không đơn nào đang giữ thùng này.",
    noOpenTask: "Thùng không có việc nào đang làm.",
    noHistory: "Chưa có biến động nào.",
    openTaskLink: "Mở việc",
    viewLocation: "Xem vị trí",
    historyNoPermission: "Bạn không có quyền xem lịch sử di chuyển.",
    historyTruncated: (shown: number, total: number) =>
      `Chỉ hiện ${shown} / ${total} biến động gần nhất — các dòng cũ hơn xem ở màn Lịch sử biến động.`,
    none: "—",
    loadFailed: "Không tải được — thử lại sau.",
  },
} as const;
