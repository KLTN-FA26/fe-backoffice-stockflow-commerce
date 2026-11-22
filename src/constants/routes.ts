const ADMIN_BASE = "/admin";
const PORTAL_BASE = "/portal";
/** Đoạn cuối URL trang cấu hình in; breadcrumb của topbar đọc nhãn theo đoạn này. */
export const PRINT_CONFIG_SEGMENT = "print-config";

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  /** Tự đổi mật khẩu — mọi nhân viên; tài khoản còn mật khẩu tạm bị buộc vào đây (BE PASSWORD_CHANGE_REQUIRED). */
  changePassword: "/change-password",
} as const;

const WAREHOUSE_MAP_ROOT = `${ADMIN_BASE}/warehouse-map`;

const workspacePage = (prefix: string, path?: string) =>
  `${WAREHOUSE_MAP_ROOT}/${encodeURIComponent(prefix)}${path ? `/${path}` : ""}`;

const id = (value: string) => encodeURIComponent(value);

/**
 * Đoạn đường dẫn sau `/admin/warehouse-map/{prefix}` của các trang làm việc theo một kho (spec 2026-11-22 §5.4).
 * Màn vận hành nằm trong route group `(operations)` — URL không có đoạn group.
 */
export const WORKSPACE_PATHS = {
  slotting: "slotting",
  putaway: "putaway",
  putawayTask: (taskId: string) => `putaway/${id(taskId)}`,
  myTrip: "putaway/trip",
  trip: (tripId: string) => `putaway/trips/${id(tripId)}`,
  picking: "picking",
  pickingTask: (taskId: string) => `picking/${id(taskId)}`,
  packing: "packing",
  packingTask: (taskId: string) => `packing/${id(taskId)}`,
  putBacks: "put-backs",
  moves: "moves",
  cycleCounts: "cycle-counts",
  cycleCount: (countId: string) => `cycle-counts/${id(countId)}`,
} as const;

export const ADMIN_ROUTES = {
  home: ADMIN_BASE,
  customers: {
    create: `${ADMIN_BASE}/customers/create`,
    detail: (id: string) => `${ADMIN_BASE}/customers/${id}`,
    list: `${ADMIN_BASE}/customers`,
  },
  /** Hộp thư chat của Sale (WF-02 pha E2). */
  chat: {
    list: `${ADMIN_BASE}/chat`,
    detail: (id: string) => `${ADMIN_BASE}/chat/${id}`,
  },
  quotes: {
    create: `${ADMIN_BASE}/quotes/create`,
    /** Tạo báo giá cho một khách chọn sẵn (nút "Tạo báo giá" ở chi tiết khách). */
    createForCustomer: (customerId: string) =>
      `${ADMIN_BASE}/quotes/create?customerId=${encodeURIComponent(customerId)}`,
    detail: (id: string) => `${ADMIN_BASE}/quotes/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/quotes/${id}/edit`,
    list: `${ADMIN_BASE}/quotes`,
    byCustomer: (customerId: string) =>
      `${ADMIN_BASE}/quotes?customerId=${encodeURIComponent(customerId)}`,
  },
  permissions: `${ADMIN_BASE}/permissions`,
  /** Quản lý tài khoản nhân viên — BE `UserManagementController` (PR #72, SCRUM-458). */
  users: {
    list: `${ADMIN_BASE}/users`,
    detail: (id: string) => `${ADMIN_BASE}/users/${encodeURIComponent(id)}`,
  },
  /** Hồ sơ hàng tồn — BE PR #119 `InventoryItemController` (`/api/v1/inventory/items`). */
  inventoryItems: {
    list: `${ADMIN_BASE}/inventory-items`,
    detail: (id: string) => `${ADMIN_BASE}/inventory-items/${id}`,
  },
  /** Bảng giá riêng của khách hàng — BE `CustomerPriceController` (`?customerId=` giữ khách đang chọn). */
  customerPrices: {
    list: `${ADMIN_BASE}/customer-prices`,
  },
  products: {
    create: `${ADMIN_BASE}/products/create`,
    detail: (id: string) => `${ADMIN_BASE}/products/${id}`,
    edit: (id: string) => `${ADMIN_BASE}/products/${id}/edit`,
    list: `${ADMIN_BASE}/products`,
    /** Cấu hình in (model 3D) của một biến thể — chỉ sản phẩm tuỳ chỉnh; module 12. */
    printConfig: (productId: string, variantId: string) =>
      `${ADMIN_BASE}/products/${productId}/variants/${variantId}/${PRINT_CONFIG_SEGMENT}`,
  },
  orders: {
    // Đơn công nợ vượt hạn mức chờ duyệt (SCRUM-427) — segment tĩnh, ưu tiên hơn [id]
    creditHolds: `${ADMIN_BASE}/orders/credit-holds`,
    cancellationRequests: `${ADMIN_BASE}/orders/cancellation-requests`,
    /** Hồ sơ giao thất bại chờ Sale quyết (WF-05 GH-1, BE `GET /orders/delivery-failures`). */
    deliveryFailures: `${ADMIN_BASE}/orders/delivery-failures`,
    detail: (id: string) => `${ADMIN_BASE}/orders/${id}`,
    /** Khối "Hợp đồng" trong chi tiết đơn (WF-02 pha B). */
    contract: (id: string) => `${ADMIN_BASE}/orders/${id}#contract`,
    list: `${ADMIN_BASE}/orders`,
  },
  packing: {
    detail: (id: string) => `${ADMIN_BASE}/packing/${id}`,
    list: `${ADMIN_BASE}/packing`,
  },
  picking: {
    detail: (id: string) => `${ADMIN_BASE}/picking/${id}`,
    list: `${ADMIN_BASE}/picking`,
  },
  /** Hàng đợi trả hàng về kệ (BE `GET /fulfillment/put-backs`, SCRUM-275) — lọc kho trên URL. */
  putBacks: {
    list: `${ADMIN_BASE}/put-backs`,
    listInWarehouse: (warehouseId: string) =>
      `${ADMIN_BASE}/put-backs?warehouse=${encodeURIComponent(warehouseId)}`,
  },
  receipts: {
    detail: (id: string) => `${ADMIN_BASE}/receipts/${id}`,
    list: `${ADMIN_BASE}/receipts`,
  },
  /** Cất hàng (docs 05) — danh sách nhiệm vụ theo kho / phiếu nhập và màn cất một thùng. */
  putaway: {
    list: `${ADMIN_BASE}/putaway`,
    detail: (taskId: string) => `${ADMIN_BASE}/putaway/${encodeURIComponent(taskId)}`,
    /** Chuyến cất hàng đang mở của người dùng (docs 05 §4.5) — `?warehouse=` là kho mở chuyến mới. */
    myTrip: `${ADMIN_BASE}/putaway/trip`,
    trip: (tripId: string) => `${ADMIN_BASE}/putaway/trips/${encodeURIComponent(tripId)}`,
    /** Mọi nhiệm vụ của một phiếu nhập (docs 05 §4.2 "theo phiếu"). */
    byReceipt: (receiptId: string) =>
      `${ADMIN_BASE}/putaway?receipt=${encodeURIComponent(receiptId)}`,
  },
  /** Từ điển thuộc tính (BE PR #113) — thay màn "Thuộc tính biến thể" dựng từ dữ liệu mẫu. */
  attributes: `${ADMIN_BASE}/attributes`,
  /** Thương hiệu & danh mục — BE `ProductTaxonomyController` (gate product-products). */
  taxonomy: {
    list: `${ADMIN_BASE}/taxonomy`,
  },
  /** Lô giao chờ xuất / đã giao (BE `ShipmentController`, PR #137). */
  shipments: {
    list: `${ADMIN_BASE}/shipments`,
    detail: (id: string) => `${ADMIN_BASE}/shipments/${id}`,
  },
  /** Chuyến xe: đặt xe, mã vận đơn, quét kiện lên xe, bàn giao hãng (BE `DispatchController`, docs 09 §4.2). */
  loads: {
    list: `${ADMIN_BASE}/loads`,
    detail: (id: string) => `${ADMIN_BASE}/loads/${id}`,
    manifest: (id: string) => `${ADMIN_BASE}/loads/${id}/manifest`,
    /** Nhập mã vận đơn hàng loạt từ file (BE `WaybillImportController`, docs 09 §4.4). */
    waybillImport: `${ADMIN_BASE}/loads/waybill-import`,
  },
  /** Danh mục hãng vận chuyển (BE `CarrierController`, docs 09 §4.1). */
  carriers: `${ADMIN_BASE}/carriers`,
  /** Nhật ký sự kiện webhook của hãng và danh sách lỗi (BE `CarrierEventController`, docs 09 §4.5). */
  carrierEvents: `${ADMIN_BASE}/carrier-events`,
  /** Danh mục kho — BE `WarehouseController` (resource `warehouse-warehouses`, docs 06 §4.1 bước 1). */
  warehouses: {
    // Khai báo kho mới là modal trên trang này (không có route riêng)
    list: `${ADMIN_BASE}/warehouses`,
  },
  /**
   * Tab "Kho & bản đồ" (module 06) — `root` là bước chọn kho; trang làm việc theo một kho nằm dưới prefix
   * kho (duy nhất, không đổi — BR-10 / BR-13). Tiền tố `/admin/warehouse-map` = route BE khai báo cho
   * resource `warehouse-locations` (`LayoutController`).
   */
  warehouseMap: {
    root: WAREHOUSE_MAP_ROOT,
    /** Trang của một kho trong tab: `path` là đoạn sau prefix (xem `WORKSPACE_PATHS`), bỏ trống = bản đồ. */
    page: workspacePage,
    of: (prefix: string) => workspacePage(prefix),
    slotting: (prefix: string) => workspacePage(prefix, WORKSPACE_PATHS.slotting),
  },
  /**
   * Bảng sức chứa kho (docs 06 §4.6, BE `WarehouseCapacityController`): danh sách mọi kho, chi tiết theo prefix kho
   * (duy nhất, không đổi — BR-10 / BR-13) để breadcrumb đọc được mã kho thay vì UUID.
   */
  warehouseCapacity: {
    list: `${ADMIN_BASE}/warehouse-capacity`,
    detail: (prefix: string) => `${ADMIN_BASE}/warehouse-capacity/${encodeURIComponent(prefix)}`,
  },
  /** Danh mục đơn vị sản xuất (docs 17 §4.3) — BE `ProducerController` (`/producers`). */
  producers: `${ADMIN_BASE}/producers`,
  /**
   * Đơn sản xuất (docs 17 §4.3, §5.3) — BE `ProductionOrderController`. Lập chỉ từ đợt giao còn thiếu (BR-05) nên
   * không có form trắng: `create` chỉ còn là link cũ, chuyển sang tab "Cần lập" của lịch (`productionScheduleDrawUp`).
   */
  productionOrders: {
    list: `${ADMIN_BASE}/production-orders`,
    create: `${ADMIN_BASE}/production-orders/create`,
    detail: (id: string) => `${ADMIN_BASE}/production-orders/${encodeURIComponent(id)}`,
  },
  /** Lịch sản xuất & đợt giao còn thiếu (docs 17 §4.12) — BE `ProductionScheduleController`. */
  productionSchedule: `${ADMIN_BASE}/production-schedule`,
  /** Tab "Cần lập Đơn sản xuất" của lịch — nơi duy nhất bắt đầu lập (docs 17 §4.3 bước 6). `tab` = `useScheduleTab`. */
  productionScheduleDrawUp: `${ADMIN_BASE}/production-schedule?tab=batches`,
  /** Danh mục loại xe (container, xe tải, bán tải) — BE `VehicleTypeController`, PR #153. */
  vehicleTypes: `${ADMIN_BASE}/vehicle-types`,
  /** Kế hoạch xếp xe (SCRUM-287 PR F4): danh sách, lập mới, chi tiết — BE `LoadPlanController`, PR #161. */
  loadPlans: {
    list: `${ADMIN_BASE}/load-plans`,
    create: `${ADMIN_BASE}/load-plans/create`,
    detail: (id: string) => `${ADMIN_BASE}/load-plans/${id}`,
    /** Phiếu xếp hàng in được của một xe (SCRUM-287 PR F6). */
    print: (id: string, seq: number) => `${ADMIN_BASE}/load-plans/${id}/vehicles/${seq}/print`,
  },
  /** "Ước tính thử" từ file Excel EasyCargo (SCRUM-474 TRIAL-FLOW, LP2-9): chạy thử, không lưu — BE `POST /fulfillment/load-estimates/trial`. */
  loadEstimateTrial: `${ADMIN_BASE}/load-estimates/trial`,
} as const;

/** Portal khách hàng B2B (Mode B) — tách khỏi back-office, cùng phiên đăng nhập BFF. */
export const PORTAL_ROUTES = {
  home: PORTAL_BASE,
  /** Trang kích hoạt từ email mời — BE `PORTAL_ACTIVATION_URL`, token nằm ở `#token=`. */
  activate: `${PORTAL_BASE}/activate`,
  orders: {
    list: `${PORTAL_BASE}/orders`,
    detail: (id: string) => `${PORTAL_BASE}/orders/${id}`,
  },
} as const;
