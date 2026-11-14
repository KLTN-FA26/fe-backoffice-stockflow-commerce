export const STORAGE_KEYS = {
  adminProductsConfig: "stockflow:admin:products:config",
  adminPurchaseOrdersConfig: "stockflow:admin:purchase-orders:config",
  adminPurchaseOrdersSpendConfig: "stockflow:admin:purchase-orders:spend:config",
  adminReceiptsConfig: "stockflow:admin:receipts:config",
  adminInventoryItemsConfig: "stockflow:admin:inventory-items:config",
  adminVariantsConfig: "stockflow:admin:variants:config",
  adminOrdersConfig: "stockflow:admin:orders:config",
  adminCreditHoldsConfig: "stockflow:admin:orders:credit-holds:config",
  adminCancellationRequestsConfig: "stockflow:admin:orders:cancellation-requests:config",
  adminPackingConfig: "stockflow:admin:packing:config",
  adminPickingConfig: "stockflow:admin:picking:config",
  adminSuppliersConfig: "stockflow:admin:suppliers:config",
  adminCustomersConfig: "stockflow:admin:customers:config",
  adminQuotesConfig: "stockflow:admin:quotes:config",
  adminSampleRequestsConfig: "stockflow:admin:sample-requests:config",
  adminProductionOrdersConfig: "stockflow:admin:production-orders:config",
  /** Tab "Danh mục hàng" trên chi tiết NCC — số dòng/trang (dùng chung mọi NCC). */
  adminSupplierItemsConfig: "stockflow:admin:suppliers:items:config",
  adminTaxonomyBrandsConfig: "stockflow:admin:taxonomy:brands:config",
  adminTaxonomyCategoriesConfig: "stockflow:admin:taxonomy:categories:config",
  adminTransfersConfig: "stockflow:admin:transfers:config",
  adminShipmentsConfig: "stockflow:admin:shipments:config",
  adminLoadsConfig: "stockflow:admin:loads:config",
  adminVehicleTypesConfig: "stockflow:admin:vehicle-types:config",
  adminWarehousesConfig: "stockflow:admin:warehouses:config",
  adminLoadPlansConfig: "stockflow:admin:load-plans:config",
  /** sessionStorage — `requestId` của lần lập kế hoạch xếp xe (BE trả lại kế hoạch cũ khi gửi lại cùng id). */
  loadPlanRequest: "stockflow:admin:load-plans:create-request",
  /** sessionStorage — `requestId` của lần mở chuyến (BE trả lại chuyến cũ khi gửi lại cùng id). */
  loadOpenRequest: "stockflow:admin:loads:open-request",
  /** sessionStorage — mã quét không thành công theo chuyến (màn xếp hàng). */
  shipmentRejectedScans: "stockflow:admin:shipments:rejected-scans",
  /** Hàng chờ kiểm thùng: số dòng / trang (localStorage, bộ lọc nằm trên URL). */
  adminPackingQueueConfig: "stockflow:admin:packing:queue-config",
  /** sessionStorage — `requestId` của lần hoàn tất kiểm thùng, theo task (BE trả lại shipment cũ khi gửi lại). */
  packingCompletionRequest: (taskId: string) => `stockflow:admin:packing:completion:${taskId}`,
} as const;
