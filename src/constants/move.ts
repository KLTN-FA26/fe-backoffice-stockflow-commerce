import { INVENTORY_API, INVENTORY_LIMITS, INVENTORY_QUERY_KEYS } from "./inventory";
import { QUARANTINE_API, QUARANTINE_QUERY_KEYS, STOCK_PACKAGE_API } from "./quarantine";

// Wire contract: backend develop — StockOperationsController `POST /inventory/movements` (MoveStockPackagesRequest /
// MovedStockPackageResponse, từ BE 0a0226a8 2026-11-09: chỉ chuyển nguyên thùng theo LPN), StockPackageController
// `GET /inventory/stock-packages/{lpn}` + `GET /inventory/stock-packages`, LayoutController `GET /warehouses/{id}/layout`.
export const MOVE_API = {
  move: INVENTORY_API.movements,
  carton: QUARANTINE_API.carton,
  cartons: STOCK_PACKAGE_API.list,
  layout: (warehouseId: string) => `/warehouses/${encodeURIComponent(warehouseId)}/layout`,
} as const;

// BE StockPackageStatus: chỉ thùng đang trong kho mới chuyển được (docs 11 BR-04; BE INVALID_STOCK_PACKAGE_TRANSITION).
export const MOVE_CARTON_STATUS_IN_STOCK = "IN_STOCK" as const;
// BE AreaType của khu tập kết: không chuyển tay vào / ra (docs 11 BR-09; BE STAGING_MOVE_NOT_ALLOWED).
export const MOVE_STAGING_AREA_TYPE = "STAGING" as const;

export const MOVE_QUERY_KEYS = {
  layout: "move-warehouse-layout",
  cartons: "move-cartons",
  // Cache liên module: chuyển thùng đổi sổ kho, tồn theo vị trí, thùng (cách ly) và tem thùng trên bản đồ.
  movements: INVENTORY_QUERY_KEYS.movements,
  stock: INVENTORY_QUERY_KEYS.stock,
  // Gốc key thùng chung (màn cách ly đặt danh sách thùng dưới gốc này)
  stockPackage: QUARANTINE_QUERY_KEYS.carton,
  // Gốc key của `features/warehouse-map/queries.ts` (tồn theo vị trí, LPN theo bin) — feature không import nhau.
  warehouseMap: "warehouse-map",
  binCartons: "warehouse-map-bin-cartons",
} as const;

// BE `MoveStockPackagesRequest`: lpns @NotEmpty @Size(max = 500), mỗi LPN @NotBlank @Size(max = 30);
// toLocation @NotBlank @Size(max = 64).
export const MOVE_LIMITS = {
  lpnsMax: 500,
  lpnLength: 30,
  locationLength: INVENTORY_LIMITS.locationLength,
  recentSize: 10,
  // Một trang thùng của bộ tìm (BE PageResponse; mock và BE cho tối đa 100)
  cartonsSize: 100,
  // Gõ tìm thùng: chờ người dùng ngừng gõ (ms)
  searchDebounceMs: 400,
  // Tên kho = đoạn mã vị trí trước dấu gạch đầu tiên (BE `LocationId.warehouseCode()`).
  warehouseSeparator: "-",
} as const;

export const MOVE_ROUTES = {
  moves: "/admin/moves",
} as const;

export const MOVE_LABELS = {
  title: "Di chuyển nội bộ",
  subtitle:
    "Chuyển nguyên thùng (quét theo LPN) tới một vị trí khác trong cùng kho. Tổng tồn của kho không đổi.",
  formTitle: "Tạo lệnh di chuyển",
  scan: "Quét hoặc nhập LPN",
  scanHelp: "Quét từng thùng — thùng hợp lệ được thêm vào danh sách bên dưới.",
  scanning: "Đang tra thùng…",
  cartonsTitle: "Thùng sẽ chuyển",
  cartonsEmpty: "Chưa có thùng nào. Quét LPN hoặc tìm thùng bên dưới.",
  cartonsCount: (count: number) => `${count} thùng`,
  lpn: "LPN",
  sku: "SKU",
  lot: "Lô",
  onHand: "Số cái",
  currentLocation: "Vị trí hiện tại",
  unverified: "Chưa tra được thùng",
  remove: (lpn: string) => `Bỏ thùng ${lpn}`,
  toLocation: "Đến vị trí",
  toLocationHelp: "Gợi ý các vị trí đang dùng được trong kho (trừ khu tập kết).",
  submit: "Chuyển thùng",
  submitting: "Đang chuyển…",
  finderTitle: "Tìm thùng",
  finderSearch: "SKU hoặc mã vị trí",
  finderHelp: "Nhập SKU để xem thùng của SKU nằm ở đâu, hoặc mã vị trí để xem vị trí đang chứa gì.",
  finderLoading: "Đang tải thùng…",
  finderEmpty: "Không có thùng đang trong kho khớp với từ khoá.",
  finderTruncated: "Chỉ hiện trang đầu — thu hẹp từ khoá để thấy hết.",
  finderUnavailable: "Không tải được danh sách thùng — bạn vẫn có thể quét LPN.",
  finderAdd: "Thêm",
  finderAdded: "Đã thêm",
  finderReserved: "Giữ chỗ",
  finderHeld: "Thùng đang giữ cho đơn — chỉ rời vị trí khi lấy hàng",
  resultTitle: "Đã chuyển thùng",
  resultSummary: (count: number, location: string) => `Đã chuyển ${count} thùng tới ${location}.`,
  recentTitle: "Các lần chuyển gần đây",
  recentEmpty: "Chưa có lần chuyển vị trí nào.",
  recentAll: "Xem sổ kho",
  // Chip của thanh Cấu hình trên trang Di chuyển nội bộ (danh sách = các lần chuyển gần nhất của kho)
  recentShown: "Hiển thị",
  recentShownValue: (count: number) => `${count} lần gần nhất`,
  recentFetching: "Đang tải lại các lần chuyển",
  recentUnavailable: "Bạn không có quyền xem sổ kho nên không hiện các lần chuyển gần đây.",
  retry: "Thử lại",
  trace: "Mã tra cứu",
  missing: "—",
  denied: "Bạn không có quyền chuyển vị trí tồn kho",
  deniedDescription: "Liên hệ quản trị viên để được cấp quyền phù hợp.",
} as const;

export const MOVE_MESSAGES = {
  required: "Trường bắt buộc",
  noCartons: "Thêm ít nhất một thùng để chuyển.",
  lpnLength: `LPN tối đa ${MOVE_LIMITS.lpnLength} ký tự.`,
  tooManyCartons: `Một lệnh chuyển tối đa ${MOVE_LIMITS.lpnsMax} thùng.`,
  // Tab theo kho (spec 2026-11-22): màn chỉ làm việc trong kho đang chọn; docs 11 BR-01 — BE vẫn re-check
  otherWarehouse: (prefix: string) => `Vị trí không thuộc kho ${prefix} đang làm việc.`,
  // Docs 11 BR-01 + BE requireMovableBetween: đích phải khác vị trí hiện tại của từng thùng (422 VALIDATION_FAILED).
  alreadyThere: (lpns: string) =>
    `Thùng ${lpns} đã ở sẵn vị trí đích — bỏ thùng hoặc chọn vị trí khác.`,
  // Kết quả quét từng thùng (docs 11 §4.1 bước 1)
  scanned: (lpn: string) => `Đã thêm thùng ${lpn}.`,
  duplicate: (lpn: string) => `Thùng ${lpn} đã có trong danh sách.`,
  notFound: (lpn: string) => `Không tìm thấy thùng ${lpn}.`,
  // Docs 11 BR-05: thùng đang giữ cho đơn chỉ rời vị trí bằng lấy hàng.
  held: (lpn: string) => `Thùng ${lpn} đang giữ cho đơn hàng — không chuyển tay được.`,
  // Docs 11 BR-04: chỉ thùng đang trong kho (In Stock) mới chuyển được.
  notInStock: (lpn: string, status: string) =>
    `Thùng ${lpn} đang ở trạng thái ${status} — chỉ chuyển được thùng đang trong kho.`,
  cartonOtherWarehouse: (lpn: string, prefix: string) =>
    `Thùng ${lpn} không nằm trong kho ${prefix} đang làm việc. Chuyển giữa các kho dùng Lệnh chuyển kho.`,
  lookupFailed: (lpn: string) => `Không tra được thùng ${lpn}. Vui lòng thử lại.`,
  // Không có inventory-stock-packages:READ: vẫn thêm được, BE kiểm khi gửi lệnh.
  addedUnverified: (lpn: string) =>
    `Đã thêm thùng ${lpn} — không tra được chi tiết, hệ thống sẽ kiểm khi chuyển.`,
  invalidContract: "Dữ liệu di chuyển trả về không đúng định dạng.",
  requestFailed: "Không thực hiện được lệnh di chuyển.",
} as const;

// Mã lỗi BE (ErrorCode.java) của `POST /inventory/movements` → thông điệp. Không hiện `message` của
// server: là tiếng Anh, không phải hợp đồng.
export const MOVE_ERROR_MESSAGES = {
  // 404: một LPN trong lệnh không tồn tại.
  cartonNotFound: "Có thùng không tồn tại. Kiểm tra lại LPN trong danh sách.",
  // Docs 11 BR-05 — 409: thùng đang giữ cho đơn chỉ rời vị trí bằng lấy hàng.
  cartonHeld: "Thùng đang giữ cho đơn hàng — chỉ rời vị trí khi lấy hàng. Bỏ thùng khỏi danh sách.",
  // Docs 11 BR-06 — 409: thùng hoặc vị trí đích đang thuộc một phiếu kiểm kê.
  slotUnderCount:
    "Thùng hoặc vị trí đích đang kiểm kê — chưa chuyển được cho tới khi kiểm kê xong.",
  // Docs 11 BR-04 — 409: thùng không ở trạng thái In Stock.
  cartonNotInStock:
    "Có thùng không còn trong kho (đã lấy, mất hoặc huỷ) — bỏ thùng khỏi danh sách.",
  // Docs 11 BR-01 — 409.
  crossWarehouse:
    "Thùng và vị trí đích thuộc hai kho khác nhau. Dùng Lệnh chuyển kho để chuyển giữa các kho.",
  // Docs 11 BR-09 — 409: khu tập kết chỉ nhận hàng khi lấy hàng và chỉ ra khi xuất / trả lại.
  staging: "Khu tập kết không nhận / trả thùng bằng lệnh chuyển tay. Chọn vị trí khác.",
  // Docs 06 BR-01, 11 BR-10 — 422: đích là bin và thùng không vừa.
  doesNotFit: "Thùng không vừa bin đích. Chọn bin lớn hơn hoặc một khu.",
  // Docs 20 BR-21: hàng cách ly rời khu bằng gỡ cách ly; hàng đang bán vào khu cách ly bằng cách ly, không chuyển tay.
  quarantined: "Thùng đang cách ly — chỉ rời khu cách ly khi gỡ cách ly.",
  areaMismatch: "Không chuyển tay thùng đang bán vào khu cách ly — dùng thao tác Cách ly.",
  statusMismatch: "Hàng trong thùng ở trạng thái không chuyển tay được.",
  locationNotFound: "Không tìm thấy vị trí đích. Kiểm tra lại mã vị trí.",
  // Vị trí đích / kệ / kho đang không hoạt động.
  locationNotUsable:
    "Vị trí đích hiện không nhận được hàng: vị trí, kệ hoặc kho đang bị chặn, bảo trì hoặc ngừng hoạt động.",
  // 422: cùng requestId mà khác danh sách thùng hoặc khác đích — gửi lại sẽ có mã mới.
  idempotencyReused: "Lệnh đã đổi so với lần gửi trước. Bấm Chuyển thùng lần nữa để gửi lệnh mới.",
  outOfScope: "Bạn không có quyền với thùng hoặc vị trí này (kho ngoài phạm vi được phân công).",
  concurrent: "Tồn vừa được người khác thay đổi. Vui lòng thử lại.",
  validation: "Dữ liệu chưa hợp lệ, hoặc có thùng đã ở sẵn vị trí đích. Vui lòng kiểm tra lại.",
  forbidden: "Bạn không có quyền chuyển vị trí tồn kho.",
  notFound: "Dữ liệu yêu cầu không tồn tại hoặc không thuộc phạm vi của bạn.",
  conflict: "Dữ liệu tồn kho đã thay đổi. Vui lòng tải lại rồi thử lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
  server: "Đã xảy ra lỗi khi xử lý lệnh di chuyển. Vui lòng thử lại.",
} as const;

export const MOVE_ERROR_TITLES = {
  failed: "Không chuyển được thùng",
  network: "Không kết nối được máy chủ",
} as const;
