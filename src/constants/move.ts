import { INVENTORY_API, INVENTORY_LIMITS, INVENTORY_QUERY_KEYS } from "./inventory";

// Wire contract: backend develop — StockOperationsController `POST /inventory/movements`
// (MoveStockRequest / StockMoveResponse), InventoryController `GET /inventory/stock-items?sku=`,
// LayoutController `GET /warehouses/{id}/layout` và `GET /locations/{code}`.
export const MOVE_API = {
  move: INVENTORY_API.movements,
  stockItems: "/inventory/stock-items",
  layout: (warehouseId: string) => `/warehouses/${encodeURIComponent(warehouseId)}/layout`,
} as const;

export const MOVE_QUERY_KEYS = {
  layout: "move-warehouse-layout",
  // Cache liên module: ghi sổ kho + tồn đổi sau khi chuyển vị trí (cùng root với Inventory).
  movements: INVENTORY_QUERY_KEYS.movements,
  stock: INVENTORY_QUERY_KEYS.stock,
} as const;

// BE `MoveStockRequest`: quantity @Min(1) @Max(1_000_000); lotNumber / location @Size(max = 64).
export const MOVE_LIMITS = {
  quantityMin: 1,
  quantityMax: 1_000_000,
  locationLength: INVENTORY_LIMITS.locationLength,
  lotLength: INVENTORY_LIMITS.lotLength,
  recentSize: 10,
  // Tên kho = đoạn mã vị trí trước dấu gạch đầu tiên (BE `LocationId.warehouseCode()`).
  warehouseSeparator: "-",
} as const;

export const MOVE_ROUTES = {
  moves: "/admin/moves",
} as const;

export const MOVE_LABELS = {
  title: "Di chuyển nội bộ",
  subtitle:
    "Chuyển tồn không giữ chỗ giữa hai vị trí trong cùng một kho. Tổng tồn của kho không đổi.",
  formTitle: "Tạo lệnh di chuyển",
  sku: "SKU",
  skuHelp: "Nhập SKU để xem tồn hiện có theo vị trí.",
  lot: "Lô",
  lotHelp: "Chỉ nhập khi SKU quản lý theo lô.",
  fromLocation: "Từ vị trí",
  toLocation: "Đến vị trí",
  toLocationHelp: "Gợi ý các vị trí đang dùng được trong cùng kho với vị trí nguồn.",
  quantity: "Số lượng",
  quantityHelp: "Theo đơn vị cơ sở của SKU; chỉ chuyển được phần chưa giữ chỗ.",
  movableUpTo: "Tối đa chuyển được",
  submit: "Chuyển vị trí",
  submitting: "Đang chuyển…",
  another: "Tạo lệnh khác",
  stockTitle: "Tồn hiện có của SKU",
  stockLoading: "Đang tải tồn kho…",
  stockEmpty: "SKU này chưa có tồn tại vị trí nào trong phạm vi kho của bạn.",
  stockPick: "Chọn làm nguồn",
  stockPicked: "Đang chọn",
  stockLocation: "Vị trí",
  stockLot: "Lô",
  stockStatus: "Trạng thái",
  stockOnHand: "Tồn",
  stockReserved: "Giữ chỗ",
  stockMovable: "Chuyển được",
  stockUnavailable: "Không xem được tồn của SKU — bạn vẫn có thể nhập vị trí nguồn thủ công.",
  resultTitle: "Đã chuyển vị trí",
  resultSummary: "Đã chuyển",
  resultAt: "Lúc",
  resultMovement: "Mã biến động",
  recentTitle: "Các lần chuyển gần đây",
  recentEmpty: "Chưa có lần chuyển vị trí nào.",
  recentAll: "Xem sổ kho",
  recentUnavailable: "Bạn không có quyền xem sổ kho nên không hiện các lần chuyển gần đây.",
  retry: "Thử lại",
  trace: "Mã tra cứu",
  missing: "—",
  denied: "Bạn không có quyền chuyển vị trí tồn kho",
  deniedDescription: "Liên hệ quản trị viên để được cấp quyền phù hợp.",
} as const;

export const MOVE_MESSAGES = {
  required: "Trường bắt buộc",
  invalidSku: "SKU gồm 1–64 ký tự chữ, số, '.', '_' hoặc '-', bắt đầu bằng chữ hoặc số.",
  quantity: "Số lượng phải là số nguyên từ 1 đến 1.000.000.",
  // Docs 11 §6 (BR-01) + BE `StockOperationsServiceImpl.relocate`: hai vị trí phải khác nhau.
  sameLocation: "Vị trí đích phải khác vị trí nguồn.",
  // Docs 11 §6 BR-01: khác kho → dùng lệnh chuyển kho (docs 10); BE MOVE_ACROSS_WAREHOUSES.
  crossWarehouse: "Hai vị trí phải thuộc cùng một kho. Chuyển giữa các kho dùng Lệnh chuyển kho.",
  exceedsMovable: "Vượt số lượng chưa giữ chỗ tại vị trí nguồn.",
  invalidContract: "Dữ liệu di chuyển trả về không đúng định dạng.",
  requestFailed: "Không thực hiện được lệnh di chuyển.",
} as const;

// Mã lỗi BE (ErrorCode.java) của `POST /inventory/movements` → thông điệp. Không hiện `message` của
// server: là tiếng Anh, không phải hợp đồng.
export const MOVE_ERROR_MESSAGES = {
  // Docs 11 BR-01: vị trí nguồn và đích khác kho.
  crossWarehouse:
    "Hai vị trí thuộc hai kho khác nhau. Dùng Lệnh chuyển kho để chuyển giữa các kho.",
  // StockOperationsServiceImpl: vị trí đích không tồn tại.
  locationNotFound: "Không tìm thấy vị trí đích. Kiểm tra lại mã vị trí.",
  // Vị trí đích / kệ / kho đang không hoạt động (BR-03 trạng thái vị trí đích).
  locationNotUsable:
    "Vị trí đích hiện không nhận được hàng: vị trí, kệ hoặc kho đang bị chặn, bảo trì hoặc ngừng hoạt động.",
  // Không có dòng tồn của SKU (và lô) tại vị trí nguồn.
  stockItemNotFound: "Không tìm thấy tồn của SKU/lô này tại vị trí nguồn.",
  // StockItem.moveOut: chỉ chuyển được phần chưa giữ chỗ (đơn hàng đang giữ — BR-04).
  insufficientStock:
    "Không đủ tồn chưa giữ chỗ tại vị trí nguồn. Phần đang giữ cho đơn hàng không chuyển được — hãy hủy giữ chỗ trước.",
  // Đích đang chứa cùng SKU/lô ở trạng thái khác (tồn QC không gộp).
  statusMismatch: "Vị trí đích đang chứa SKU/lô này ở trạng thái khác nên không gộp được.",
  // Nhiều lớp tồn cùng SKU/lô tại nguồn hoặc đích không tương thích chính sách tồn.
  policyConflict:
    "Vị trí nguồn hoặc đích có nhiều lớp tồn của SKU/lô này nên không xác định được phần cần chuyển.",
  outOfScope: "Bạn không có quyền với một trong hai vị trí (kho ngoài phạm vi được phân công).",
  concurrent: "Tồn vừa được người khác thay đổi. Vui lòng thử lại.",
  validation: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.",
  forbidden: "Bạn không có quyền chuyển vị trí tồn kho.",
  notFound: "Dữ liệu yêu cầu không tồn tại hoặc không thuộc phạm vi của bạn.",
  conflict: "Dữ liệu tồn kho đã thay đổi. Vui lòng tải lại rồi thử lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
  server: "Đã xảy ra lỗi khi xử lý lệnh di chuyển. Vui lòng thử lại.",
} as const;

export const MOVE_ERROR_TITLES = {
  failed: "Không chuyển được vị trí",
  network: "Không kết nối được máy chủ",
} as const;
