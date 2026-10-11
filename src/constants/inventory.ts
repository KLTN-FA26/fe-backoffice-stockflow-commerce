// Wire contract: backend develop 1de8f426, SCRUM-424 / StockOperationsController.
export const INVENTORY_API = {
  adjustments: "/v1/inventory/adjustments",
  adjustment: (id: string) => `/v1/inventory/adjustments/${encodeURIComponent(id)}`,
  approval: (id: string) => `/v1/inventory/adjustments/${encodeURIComponent(id)}/approval`,
  rejection: (id: string) => `/v1/inventory/adjustments/${encodeURIComponent(id)}/rejection`,
  withdrawal: (id: string) => `/v1/inventory/adjustments/${encodeURIComponent(id)}/withdrawal`,
  movements: "/v1/inventory/movements",
} as const;

export const INVENTORY_QUERY_KEYS = {
  adjustments: "inventory-stock-adjustments",
  movements: "inventory-stock-movements",
  stock: "inventory-stock-items",
} as const;

export const STOCK_ADJUSTMENT_REASONS = [
  "DAMAGED",
  "LOST",
  "FOUND",
  "EXPIRED",
  "DATA_CORRECTION",
  "SCRAP",
  "SAMPLE",
  "OTHER",
] as const;

export const STOCK_ADJUSTMENT_REASON = {
  OTHER: "OTHER",
  SAMPLE: "SAMPLE",
  SCRAP: "SCRAP",
} as const;

export const STOCK_MOVEMENT_TYPES = ["RECEIPT", "MOVE", "ADJUSTMENT", "TRANSFER_OUT"] as const;
export const STOCK_ADJUSTMENT_ACTION = {
  APPROVE: "approve",
  REJECT: "reject",
  WITHDRAW: "withdraw",
} as const;

export const INVENTORY_LIMITS = {
  delta: 1_000_000,
  locationLength: 64,
  lotLength: 64,
  noteLength: 1000,
  rejectionLength: 500,
  skuMaxLength: 64,
  skuMinLength: 3,
} as const;

export const INVENTORY_MESSAGES = {
  invalidContract: "Dữ liệu tồn kho trả về không đúng định dạng.",
  required: "Trường bắt buộc",
  nonzeroDelta: "Số lượng điều chỉnh phải khác 0.",
  writeDown: "Phế phẩm và làm mẫu chỉ được giảm tồn kho.",
  otherNote: "Cần giải thích khi chọn lý do khác.",
  invalidSku: "SKU phải gồm 3–64 ký tự chữ, số hoặc dấu gạch ngang.",
  requestFailed: "Không thực hiện được yêu cầu tồn kho.",
} as const;
