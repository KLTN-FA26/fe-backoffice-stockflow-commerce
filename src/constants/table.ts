export const PAGE_SIZE = {
  masterData: 500,
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
  WAREHOUSE: "warehouse",
} as const;

export const RECEIPT_COLUMNS = {
  ACTIONS: "actions",
  LINE_COUNT: "lineCount",
  PO_REFERENCE: "poReference",
  RECEIPT_NUMBER: "receiptNumber",
  STATUS: "status",
  SUPPLIER: "supplier",
  WAREHOUSE: "warehouse",
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
