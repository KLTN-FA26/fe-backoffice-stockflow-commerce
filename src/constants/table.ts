export const PAGE_SIZE = {
  masterData: 200,
  sm: 10,
  md: 15,
  lg: 25,
  xl: 50,
} as const;

/** Cột danh sách phiếu nhận — chỉ field có trong BE `GoodsReceiptRowResponse` (PR #62). */
export const RECEIPT_COLUMNS = {
  ACTIONS: "actions",
  CONFIRMED_AT: "confirmedAt",
  DELIVERY_NOTE: "deliveryNote",
  NUMBER: "number",
  PRODUCTION_ORDER: "productionOrder",
  RECEIPT_TYPE: "receiptType",
  RECEIVED_AT: "receivedAt",
  STATUS: "status",
} as const;

/** Cột danh sách task xuất kho — chỉ field có trong BE `FulfillmentTaskResponse`. */
export const FULFILLMENT_COLUMNS = {
  ACTIONS: "actions",
  ASSIGNED_AT: "assignedAt",
  ASSIGNEE: "assignee",
  ORDER: "order",
  PACK_STATUS: "packStatus",
  PACKED_AT: "packedAt",
  PICK_STATUS: "pickStatus",
  PICKED_AT: "pickedAt",
  STARTED_AT: "startedAt",
  TASK: "task",
} as const;

export const PRODUCT_COLUMNS = {
  ACTIONS: "actions",
  CATEGORY: "category",
  NAME: "name",
  PRODUCT_ID: "productId",
  SKU_COUNT: "skuCount",
  STATUS: "status",
  TYPE: "type",
} as const;

export const SKU_COLUMNS = {
  ACTIONS: "actions",
  BARCODE: "barcode",
  COST: "cost",
  PRODUCT: "product",
  PRODUCT_ID: "productId",
  SKU_ID: "skuId",
  STATUS: "status",
  STOCK_AVAILABLE: "stockAvailable",
  STOCK_ON_HAND: "stockOnHand",
  UOM: "uom",
  VARIANT_LABEL: "variantLabel",
} as const;

/** Cột bảng thương hiệu (BE `BrandResponse`). */
export const TAXONOMY_BRAND_COLUMNS = {
  CODE: "code",
  LOGO: "logo",
  NAME: "name",
  SLUG: "slug",
  ACTIVE: "active",
} as const;

/** Cột bảng danh mục (BE `CategoryResponse`) — cây theo thứ tự `path`, tên thụt lề theo `depth`. */
export const TAXONOMY_CATEGORY_COLUMNS = {
  CODE: "code",
  NAME: "name",
  LEVEL: "level",
  SORT_ORDER: "sortOrder",
  ACTIVE: "active",
} as const;

export const VARIANT_COLUMNS = {
  ATTRIBUTE_ID: "attributeId",
  NAME_EN: "nameEn",
  NAME_VI: "nameVi",
  VALUES: "values",
} as const;

/** Cột bảng hồ sơ hàng tồn (BE PR #119 `InventoryItemResponse`). */
export const INVENTORY_ITEM_COLUMNS = {
  SKU: "sku",
  UOM: "unitOfMeasure",
  BARCODE: "barcode",
} as const;

/** Cột danh sách chuyến xe (BE `LoadRowResponse`). */
export const LOAD_COLUMNS = {
  ACTIONS: "actions",
  PLAN: "plan",
  CARRIER: "carrier",
  CODE: "code",
  DISPATCHED_AT: "dispatchedAt",
  PROGRESS: "progress",
  SHIPMENTS: "shipments",
  STATUS: "status",
  VEHICLE: "vehicle",
  WAYBILL: "waybill",
} as const;

/** Cột danh mục hãng vận chuyển (BE `CarrierResponse`). */
export const CARRIER_COLUMNS = {
  ACTIONS: "actions",
  CODE: "code",
  CONNECTION: "connection",
  CONTACT: "contact",
  NAME: "name",
  STATUS: "status",
} as const;

/** Cột danh mục kho (BE `WarehouseResponse`). */
export const WAREHOUSE_COLUMNS = {
  ACTIONS: "actions",
  ADDRESS: "address",
  MAP_SIZE: "mapSize",
  NAME: "name",
  PREFIX: "prefix",
  STATUS: "status",
} as const;

/** Cột Bảng sức chứa kho — một dòng mỗi kho (BE `WarehouseCapacityBoard`, docs 06 §4.6 bước 3). */
export const WAREHOUSE_CAPACITY_COLUMNS = {
  ACTIONS: "actions",
  WAREHOUSE: "warehouse",
  CAPACITY: "capacity",
  OCCUPIED: "occupied",
  INCOMING: "incoming",
  PROJECTED_FREE: "projectedFree",
  PENDING: "pending",
  FREE_IF_ALL_APPROVED: "freeIfAllApproved",
  OUTGOING: "outgoing",
} as const;

/** Cột bảng zone / kệ / khu của một kho (BE `WarehouseCapacityGroup`, docs 06 §4.6 bước 4). */
export const CAPACITY_GROUP_COLUMNS = {
  NAME: "name",
  CAPACITY: "capacity",
  OCCUPIED: "occupied",
  FREE: "free",
  USAGE: "usage",
  BINS_WITHOUT_VOLUME: "binsWithoutVolume",
} as const;

/** Cột danh sách loại xe (BE `VehicleTypeResponse`). */
export const VEHICLE_TYPE_COLUMNS = {
  ACTIONS: "actions",
  AVAILABLE_COUNT: "availableCount",
  CODE: "code",
  DOOR: "door",
  GUSSET: "gusset",
  INNER_SIZE: "innerSize",
  KIND: "kind",
  NAME: "name",
  PAYLOAD: "payload",
  STATUS: "status",
} as const;

/** Cột danh mục đơn vị sản xuất (BE `ProducerResponse`, docs 17 §4.3). */
export const PRODUCER_COLUMNS = {
  ACTIONS: "actions",
  CHANNEL: "channel",
  CODE: "code",
  CONTACT: "contact",
  LEAD_DAYS: "leadDays",
  NAME: "name",
  STATUS: "status",
} as const;

/** Cột danh sách Đơn sản xuất (BE `ProductionOrderResponse`, docs 17 §4.3). */
export const PRODUCTION_ORDER_COLUMNS = {
  CARTONS: "cartons",
  CODE: "code",
  EXPECTED: "expected",
  NEED_BY: "needBy",
  PRODUCER: "producer",
  SAMPLE: "sample",
  STATUS: "status",
  WAREHOUSE: "warehouse",
} as const;

/** Cột lịch sản xuất (BE `ScheduledProductionOrder`, docs 17 §4.12 bước 47). */
export const PRODUCTION_SCHEDULE_COLUMNS = {
  ALERTS: "alerts",
  CARTONS: "cartons",
  CODE: "code",
  EXPECTED: "expected",
  NEED_BY: "needBy",
  ORDER: "order",
  PRODUCER: "producer",
  STATUS: "status",
  WAREHOUSE: "warehouse",
  WINDOW: "window",
} as const;

/** Cột danh sách cất hàng (BE `PutawayTaskResponse`, docs 05 §4.2). */
export const PUTAWAY_COLUMNS = {
  ACTION: "action",
  LOT: "lot",
  LPN: "lpn",
  QUANTITY: "quantity",
  SKU: "sku",
  SOURCE: "source",
  SOURCE_LOCATION: "sourceLocation",
  STATUS: "status",
} as const;

/** Cột bảng thùng trên xe của chuyến cất hàng (BE `PutawayTripResponse.Carton`, docs 05 §4.5). */
export const PUTAWAY_TRIP_CART_COLUMNS = {
  ACTION: "action",
  BIN: "bin",
  ITEM: "item",
  LPN: "lpn",
  STATUS: "status",
} as const;

/** Cột đợt giao còn thiếu (BE `ShortDeliveryBatch`, docs 17 §4.12 bước 47). */
export const SHORT_BATCH_COLUMNS = {
  ACTION: "action",
  ALERTS: "alerts",
  LINES: "lines",
  ORDER: "order",
  SHORT: "short",
  WAREHOUSE: "warehouse",
  WINDOW: "window",
} as const;

/** Cột danh sách kế hoạch xếp xe (BE `LoadPlans.PlanRow`). */
export const LOAD_PLAN_COLUMNS = {
  CODE: "code",
  CREATED_AT: "createdAt",
  MODE: "mode",
  PACKAGES: "packages",
  SHIPMENTS: "shipments",
  STATUS: "status",
  UNPLACED: "unplaced",
  VEHICLES: "vehicles",
} as const;

/** Cột danh sách lô giao (BE `ShipmentRowResponse`). */
export const SHIPMENT_COLUMNS = {
  ACTIONS: "actions",
  CARRIER: "carrier",
  CODE: "code",
  LOAD: "load",
  ORDER: "order",
  PACKAGES: "packages",
  READY_AT: "readyAt",
  STATUS: "status",
} as const;

/** Cột danh sách vị trí của một kho (layout BE `GET /warehouses/{id}/layout` + tồn theo vị trí, docs 06 / 20 §4.1). */
export const WAREHOUSE_LOCATION_COLUMNS = {
  ACTIONS: "actions",
  CAPACITY: "capacity",
  CODE: "code",
  KIND: "kind",
  LEVEL: "level",
  MAX_WEIGHT: "maxWeight",
  ON_HAND: "onHand",
  RESERVED: "reserved",
  SHELF: "shelf",
  SKUS: "skus",
  STATUS: "status",
  USES: "uses",
  ZONE: "zone",
} as const;
