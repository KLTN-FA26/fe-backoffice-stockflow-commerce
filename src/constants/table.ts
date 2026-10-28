export const PAGE_SIZE = {
  masterData: 200,
  sm: 10,
  md: 15,
  lg: 25,
  xl: 50,
} as const;

export const PO_COLUMNS = {
  ACTIONS: "actions",
  EXPECTED_DATE: "expectedDate",
  GRAND_TOTAL: "grandTotal",
  PO_NUMBER: "poNumber",
  STATUS: "status",
  SUPPLIER: "supplier",
} as const;

/** Cột danh sách phiếu nhận — chỉ field có trong BE `GoodsReceiptRowResponse` (PR #62). */
export const RECEIPT_COLUMNS = {
  ACTIONS: "actions",
  CONFIRMED_AT: "confirmedAt",
  DELIVERY_NOTE: "deliveryNote",
  NUMBER: "number",
  PURCHASE_ORDER: "purchaseOrder",
  RECEIVED_AT: "receivedAt",
  STATUS: "status",
} as const;

/** Cột danh sách task xuất kho — chỉ field có trong BE `FulfillmentTaskResponse`. */
export const FULFILLMENT_COLUMNS = {
  ACTIONS: "actions",
  ASSIGNED_AT: "assignedAt",
  ASSIGNEE: "assignee",
  INTEGRITY: "integrity",
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

export const INVOICE_COLUMNS = {
  ACTIONS: "actions",
  DUE_DATE: "dueDate",
  GRAND_TOTAL: "grandTotal",
  INVOICE_DATE: "invoiceDate",
  INVOICE_NUMBER: "invoiceNumber",
  PO_REFERENCE: "poReference",
  STATUS: "status",
  SUPPLIER: "supplier",
} as const;

export const VARIANT_COLUMNS = {
  ATTRIBUTE_ID: "attributeId",
  NAME_EN: "nameEn",
  NAME_VI: "nameVi",
  VALUES: "values",
} as const;

/** Cột danh sách lệnh chuyển kho — field BE `TransferOrderRowResponse`. */
export const TRANSFER_COLUMNS = {
  ACTIONS: "actions",
  CREATED_AT: "createdAt",
  DELIVERY_MODE: "deliveryMode",
  DISPATCHED_AT: "dispatchedAt",
  EXPECTED_DATE: "expectedDate",
  FROM_WAREHOUSE: "fromWarehouse",
  NUMBER: "number",
  PACKED_AT: "packedAt",
  STATUS: "status",
  TO_WAREHOUSE: "toWarehouse",
} as const;

/** Cột bảng hồ sơ hàng tồn (BE PR #119 `InventoryItemResponse`). */
export const INVENTORY_ITEM_COLUMNS = {
  SKU: "sku",
  UOM: "unitOfMeasure",
  BARCODE: "barcode",
  STORAGE: "storageClass",
  TRACKING: "trackingMode",
  POLICY: "policyConfigured",
} as const;

/** Cột danh sách chuyến xe (BE `LoadRowResponse`). */
export const LOAD_COLUMNS = {
  ACTIONS: "actions",
  MODE: "mode",
  PLAN: "plan",
  CARRIER: "carrier",
  COD: "cod",
  CODE: "code",
  DISPATCHED_AT: "dispatchedAt",
  PROGRESS: "progress",
  SHIPMENTS: "shipments",
  STATUS: "status",
  VEHICLE: "vehicle",
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

/** Cột danh sách kế hoạch xếp xe (BE `LoadPlans.PlanRow`). */
export const LOAD_PLAN_COLUMNS = {
  CODE: "code",
  CREATED_AT: "createdAt",
  MODE: "mode",
  PACKAGES: "packages",
  SHIPMENTS: "shipments",
  /** Nguồn của kế hoạch: đơn khách hay lệnh chuyển kho (SCRUM-287 PR F9). */
  SOURCE: "source",
  STATUS: "status",
  UNPLACED: "unplaced",
  VEHICLES: "vehicles",
} as const;

/** Cột danh sách lô giao (BE `ShipmentRowResponse`). */
export const SHIPMENT_COLUMNS = {
  ACTIONS: "actions",
  CARRIER: "carrier",
  COD: "cod",
  CODE: "code",
  LOAD: "load",
  ORDER: "order",
  PACKAGES: "packages",
  READY_AT: "readyAt",
  STATUS: "status",
} as const;
