/**
 * Nhãn màn Danh sách vị trí của một kho (tab Kho): mã bin / khu vực, cấu trúc kho (docs 06) và hàng đang nằm ở vị trí
 * (tồn theo vị trí, thùng LPN — docs 20 §4.1). Tách khỏi `labels-warehouse-map.ts` cho gọn.
 */

import type { WAREHOUSE_LOCATION_COLUMNS } from "./table";

type LocationColumn = (typeof WAREHOUSE_LOCATION_COLUMNS)[keyof typeof WAREHOUSE_LOCATION_COLUMNS];

/** Loại vị trí: bin trên kệ hoặc khu vực sàn có mã vị trí (khu `NON_STORAGE` không có mã — không liệt kê). */
export const LOCATION_KINDS = ["bin", "area"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

/** Lọc theo có hàng / trống (chỉ khi đọc được tồn của cả kho). */
export const LOCATION_STOCK_FILTERS = ["stocked", "empty"] as const;
export type LocationStockFilter = (typeof LOCATION_STOCK_FILTERS)[number];

const COLUMN: Record<LocationColumn, string> = {
  code: "Mã vị trí",
  kind: "Loại",
  zone: "Zone",
  shelf: "Kệ",
  level: "Tầng",
  status: "Trạng thái",
  uses: "Dùng cho",
  capacity: "Sức chứa (m³)",
  maxWeight: "Tải tối đa (kg)",
  skus: "SKU",
  onHand: "Tồn (cái)",
  reserved: "Đang giữ (cái)",
  actions: "Thao tác",
};

export const WAREHOUSE_LOCATION_LABELS = {
  pageTitle: "Danh sách vị trí",
  searchPlaceholder: "Tìm mã vị trí hoặc SKU…",
  column: COLUMN,
  columnSearch: (label: string) => `Tìm trong cột ${label.toLocaleLowerCase("vi")}`,
  optionSearch: "Tìm…",
  optionEmpty: "Không có lựa chọn",
  kind: { bin: "Bin", area: "Khu vực" } satisfies Record<LocationKind, string>,
  stockFilter: { stocked: "Có hàng", empty: "Trống" } satisfies Record<LocationStockFilter, string>,
  noZone: "Không thuộc zone",
  pickable: "Lấy hàng",
  putawayTarget: "Cất hàng",
  notUsable: "Không dùng được",
  /** Khu vực không có sức chứa (docs 06 §4.6, chốt 2026-11-13). */
  noCapacity: "Khu vực không tính sức chứa",
  moreSkus: (count: number) => `+${count} SKU`,
  // Thanh Cấu hình
  summarySearch: "Search chính",
  summaryColumnSearch: "Search trong cột",
  summaryColumns: "Cột hiển thị",
  all: "Tất cả",
  // Thông báo
  stockNoPermission:
    "Bạn không có quyền xem tồn kho — danh sách chỉ hiện mã và cấu trúc vị trí, không có hàng trong vị trí.",
  stockNotAssigned:
    "Bạn không được gán kho này — chỉ xem được mã và cấu trúc vị trí, không xem được hàng trong vị trí.",
  stockError: "Không tải được tồn theo vị trí — cột hàng trong vị trí đang để trống.",
  stockTruncated: (shown: number, total: number) =>
    `Kho có ${total} dòng tồn, mới đọc ${shown} dòng — cột hàng có thể thiếu và chưa lọc được "Có hàng / Trống".`,
  emptyTitle: "Kho chưa có vị trí nào",
  emptyDescription: "Thêm kệ, sinh bin hoặc vẽ khu vực trên bản đồ kho để có vị trí.",
  openMap: "Mở bản đồ kho",
  filteredTitle: "Không tìm thấy vị trí",
  filteredDescription: "Không vị trí nào khớp bộ lọc hiện tại.",
  clearFilters: "Bỏ bộ lọc",
  errorCopy: {
    pageTitle: "Danh sách vị trí",
    notFoundTitle: "Không tìm thấy kho",
    notFoundDescription: "Kho này không còn hoặc đường dẫn sai.",
    forbiddenDescription: "Bạn không có quyền xem vị trí của kho này.",
    noReadDescription: "Bạn không có quyền xem bản đồ và vị trí kho.",
  },
  // Panel chi tiết
  openDetail: (code: string) => `Xem chi tiết ${code}`,
  detail: {
    general: "Thông tin chung",
    contents: "Hàng trong vị trí",
    cartons: "Thùng (LPN)",
    size: "Kích thước (rộng × dài)",
    usableHeight: "Chiều cao lọt tầng",
    type: "Loại bin / khu",
    lot: "Lô",
    stockStatus: "Trạng thái tồn",
    wholeCartons: "Số thùng",
    cartonUnits: "Cái trong thùng",
    looseUnits: "Cái lẻ",
    totalUnits: "Tổng (cái)",
    lpn: "LPN",
    nominal: "Danh nghĩa",
    remaining: "Còn",
    noContents: "Vị trí đang trống.",
    noCartons: "Không có thùng nào ở vị trí này.",
    cartonsTruncated: (shown: number, total: number) => `Hiện ${shown} / ${total} thùng đầu tiên.`,
    contentsNoPermission: "Bạn không có quyền xem hàng trong vị trí.",
    cartonsNoPermission: "Bạn không có quyền xem danh sách thùng.",
    loadFailed: "Không tải được — thử lại sau.",
    viewOnMap: "Xem trên bản đồ",
    movements: "Lịch sử di chuyển",
  },
} as const;

/** Nút sao chép mã (LPN, mã vị trí…) — dùng chung mọi màn. */
export const CLIPBOARD_LABELS = {
  copy: (value: string) => `Sao chép ${value}`,
  copied: (value: string) => `Đã sao chép ${value}`,
  failed: "Không sao chép được — hãy chọn mã và sao chép thủ công",
} as const;
