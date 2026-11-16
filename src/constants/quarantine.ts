/**
 * Cách ly thùng lỗi (docs 20 §4.8, BR-21). Hợp đồng chép từ BE develop df34c338 `StockPackageController`
 * (`/api/v1/inventory/stock-packages`): tra thùng theo LPN, cách ly nguyên thùng, gỡ cách ly. Ghi giảm thùng lỗi đi
 * theo điều chỉnh `DAMAGED` có duyệt (màn Điều chỉnh tồn), không phải ở đây.
 */
export const QUARANTINE_API = {
  carton: (lpn: string) => `/inventory/stock-packages/${encodeURIComponent(lpn)}`,
  quarantine: (lpn: string) => `/inventory/stock-packages/${encodeURIComponent(lpn)}/quarantine`,
  release: (lpn: string) =>
    `/inventory/stock-packages/${encodeURIComponent(lpn)}/quarantine-release`,
} as const;

export const QUARANTINE_QUERY_KEYS = { carton: "inventory-stock-package" } as const;

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
    "Mở nhiệm vụ cất hàng đưa thùng về bin. Thùng vẫn ở trạng thái cách ly tới khi cất xong, lúc đó mới thành Available.",
  writeOff: "Ghi giảm thùng lỗi",
  heldForOrder:
    "Thùng đang được giữ cho một đơn hàng. Nhả hoặc phân bổ lại thùng cho đơn trước khi cách ly.",
  released: "Đã mở nhiệm vụ cất hàng cho thùng này.",
  back: "Quay lại",
  loadError: "Không tra cứu được thùng",
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
  forbidden: "Bạn không có quyền thực hiện thao tác này với thùng hàng.",
  outOfScope: "Bạn không có quyền với thùng của kho này.",
  validation: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
} as const;
