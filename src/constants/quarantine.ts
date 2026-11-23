/**
 * Cách ly thùng lỗi (docs 20 §4.8, BR-21). Hợp đồng chép từ BE develop df34c338 `StockPackageController`
 * (`/api/v1/inventory/stock-packages`): tra thùng theo LPN, cách ly nguyên thùng, gỡ cách ly. Ghi giảm thùng lỗi đi
 * theo điều chỉnh `DAMAGED` có duyệt (màn Điều chỉnh tồn), không phải ở đây.
 */
/** Danh sách thùng theo trang — dùng chung cho màn cách ly và tem LPN trên bản đồ 3D (đúng một mã `location`). */
export const STOCK_PACKAGE_API = {
  list: "/inventory/stock-packages",
} as const;

export const QUARANTINE_API = {
  /**
   * `GET /inventory/stock-packages?location&sku&status&page&size&sort` (`inventory-stock-packages:READ`): thùng theo trang.
   * Không có trạng thái QUARANTINE cho thùng — khu cách ly lọc bằng `location` = mã khu / bin cách ly (đúng một mã).
   */
  list: STOCK_PACKAGE_API.list,
  carton: (lpn: string) => `/inventory/stock-packages/${encodeURIComponent(lpn)}`,
  quarantine: (lpn: string) => `/inventory/stock-packages/${encodeURIComponent(lpn)}/quarantine`,
  release: (lpn: string) =>
    `/inventory/stock-packages/${encodeURIComponent(lpn)}/quarantine-release`,
} as const;

export const QUARANTINE_QUERY_KEYS = {
  carton: "inventory-stock-package",
  list: "inventory-stock-packages",
} as const;

export const QUARANTINE_STORAGE_KEYS = {
  list: "stockflow:admin:inventory:quarantine:config",
} as const;

// BE StockStatus của hàng trong thùng (docs 20 §5.1).
export const QUARANTINE_STOCK_STATUS = "QUARANTINE" as const;
// BE StockPackageStatus: chỉ thùng đang trong kho (`In Stock`) mới cách ly / gỡ cách ly được.
export const QUARANTINE_PACKAGE_STATUS_IN_STOCK = "IN_STOCK" as const;

export const QUARANTINE_ACTION = {
  QUARANTINE: "quarantine",
  RELEASE: "release",
} as const;

export const QUARANTINE_LIMITS = { locationLength: 64, reasonLength: 500, lpnLength: 30 } as const;

export const QUARANTINE_LABELS = {
  title: "Cách ly thùng",
  lookupLabel: "LPN thùng",
  lookupPlaceholder: "Quét hoặc nhập LPN, ví dụ LPN-20261110-000001",
  prompt: "Nhập LPN để xem thùng",
  promptDescription:
    "Cách ly nguyên thùng lỗi sang khu QUARANTINE, gỡ cách ly thùng dùng được, hoặc ghi giảm thùng lỗi (cần người khác duyệt).",
  lpn: "LPN",
  sku: "SKU",
  lot: "Lô",
  location: "Vị trí",
  stockStatus: "Trạng thái tồn",
  onHand: "Số cái trong thùng",
  reserved: "Đang giữ cho đơn",
  missing: "—",
  quarantined: "Đang cách ly",
  notQuarantined: "Không cách ly",
  quarantine: "Cách ly thùng",
  quarantineDescription:
    "Thùng chuyển nguyên thùng sang khu QUARANTINE, ra khỏi ATP và không được phân bổ. Không cần duyệt vì không đổi số lượng.",
  quarantineLocation: "Vị trí khu cách ly",
  quarantineLocationHint: "Mã vị trí thuộc khu QUARANTINE của kho, ví dụ HCM-QC01.",
  quarantineReason: "Lý do cách ly",
  release: "Gỡ cách ly",
  releaseDescription:
    "Mở nhiệm vụ cất hàng đưa thùng về bin. Thùng vẫn ở trạng thái cách ly tới khi cất xong, lúc đó mới thành thùng bán được.",
  writeOff: "Ghi giảm thùng lỗi",
  heldForOrder:
    "Thùng đang được giữ cho một đơn hàng. Nhả hoặc phân bổ lại thùng cho đơn trước khi cách ly.",
  released: "Đã mở nhiệm vụ cất hàng cho thùng này.",
  // WF-05 BE-24 / Q-18: thùng hàng trả về đã mở — không gỡ cách ly, chỉ ghi giảm
  openedOnReturn: "Thùng hàng trả về đã mở",
  openedOnReturnYes: "Đã mở khi về",
  openedOnReturnNotice:
    "Thùng hàng trả về đã bị mở (ít hơn số trên nhãn): hàng in riêng không bán lại được, chỉ ghi giảm — không gỡ cách ly.",
  // WF-05 Q-18: từ nay thùng về đã mở không nhập lại tồn
  openedOnReturnConsumed:
    "Thùng hàng trả về đã bị mở hoặc rỗng: không nhập lại tồn, hàng đã huỷ theo số đếm thật trên phiếu nhập hàng hoàn.",
  back: "Quay lại",
  loadError: "Không tra cứu được thùng",
  backToList: "Về danh sách khu cách ly",
} as const;

/** Danh sách thùng trong khu cách ly (BE `GET /inventory/stock-packages?location=`). */
export const QUARANTINE_LIST_LABELS = {
  title: "Thùng trong khu cách ly",
  location: "Mã khu cách ly",
  locationPlaceholder: "Ví dụ HCM-QC01",
  locationHint: "Đúng một mã khu / bin thuộc khu QUARANTINE của kho.",
  sku: "SKU",
  skuPlaceholder: "Lọc theo SKU (tuỳ chọn)",
  apply: "Xem",
  reset: "Bỏ lọc",
  prompt: "Nhập mã khu cách ly",
  promptDescription:
    "Nhập mã khu QUARANTINE của kho để xem các thùng đang nằm ở đó, hoặc quét LPN ở trên để xem một thùng.",
  empty: "Khu cách ly đang trống",
  emptyDescription: "Không có thùng nào đang nằm ở vị trí này.",
  noMatch: "Không có thùng khớp SKU đã lọc",
  loadError: "Không tải được danh sách thùng",
  fetching: "Đang tải lại danh sách thùng",
  open: "Xem thùng",
  columns: {
    lpn: "LPN",
    sku: "SKU",
    lot: "Lô",
    location: "Vị trí",
    onHand: "Còn trong thùng",
    reserved: "Đang giữ cho đơn",
    status: "Trạng thái thùng",
    openedOnReturn: "Hàng trả về",
  },
  caption: "Thùng trong khu cách ly",
} as const;

// Backend develop df34c338 ErrorCode.java. Never show the backend `message`: English prose, not a contract.
export const QUARANTINE_ERROR_MESSAGES = {
  cartonNotFound: "Không tìm thấy thùng có LPN này trong phạm vi kho bạn được xem.",
  alreadyQuarantined: "Thùng này đã ở trong khu cách ly.",
  notQuarantined: "Thùng này không ở trạng thái cách ly nên chưa gỡ cách ly được.",
  notQuarantineArea: "Vị trí này không phải khu QUARANTINE của kho chứa thùng.",
  locationNotFound: "Không tìm thấy vị trí này.",
  acrossWarehouses: "Khu cách ly phải thuộc cùng kho với thùng.",
  held: "Thùng đang được giữ cho một đơn hàng. Nhả hoặc phân bổ lại thùng cho đơn trước.",
  underCount: "Thùng đang nằm trên một phiếu kiểm kê nên chưa chuyển được.",
  decisionPending:
    "Thùng này đang chờ một quyết định khác (nhiệm vụ cất hàng hoặc phiếu ghi giảm chờ duyệt).",
  notInStock: "Thùng không còn trong kho nên không thao tác được.",
  // BE `CartonQuarantineService#release` (WF-05 TH-4): thùng khách trả về đã mở, thiếu so với nhãn — chỉ ghi giảm
  returnCartonOpened: "Thùng hàng trả về đã bị mở, chỉ được huỷ/ghi giảm, không nhả ra kệ được.",
  forbidden: "Bạn không có quyền thực hiện thao tác này với thùng hàng.",
  outOfScope: "Bạn không có quyền với thùng của kho này.",
  validation: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
} as const;
