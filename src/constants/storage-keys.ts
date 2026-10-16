export const STORAGE_KEYS = {
  adminProductsConfig: "stockflow:admin:products:config",
  adminPurchaseOrdersConfig: "stockflow:admin:purchase-orders:config",
  adminPurchaseOrdersSpendConfig: "stockflow:admin:purchase-orders:spend:config",
  adminReceiptsConfig: "stockflow:admin:receipts:config",
  adminInvoicesConfig: "stockflow:admin:invoices:config",
  adminVariantsConfig: "stockflow:admin:variants:config",
  adminOrdersConfig: "stockflow:admin:orders:config",
  adminPackingConfig: "stockflow:admin:packing:config",
  adminPickingConfig: "stockflow:admin:picking:config",
  adminSuppliersConfig: "stockflow:admin:suppliers:config",
  adminTransfersConfig: "stockflow:admin:transfers:config",
  adminShipmentsConfig: "stockflow:admin:shipments:config",
  /** sessionStorage — mã quét không thành công theo chuyến (màn xếp hàng). */
  shipmentRejectedScans: "stockflow:admin:shipments:rejected-scans",
} as const;
