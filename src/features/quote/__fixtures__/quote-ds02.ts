/**
 * Báo giá theo đúng dạng JSON BE trả cho seed demo `QT-20261120-9001` (BE origin/develop 438fe6fb,
 * `db/demo/V20261124000600__demo_wf02.sql` §5): 60 thùng × 1.000 cái × 1.150 đ (bậc 50 thùng),
 * phí khuôn 1.500.000 đ, VAT 10% của seed. Trường null bị BỎ như Jackson `non_null` (designSnapshotId,
 * printSpec, customerFeedback, cancellationReason, …).
 */

export const CUSTOMER_ID = "c0000000-0000-4000-8000-000000000001";
export const QUOTE_ID = "6f3b5c1e-2d4a-4b8f-9c0d-1e2f3a4b5c6d";
export const ORDER_ID = "8a1b2c3d-4e5f-4061-8728-394a5b6c7d8e";
export const SKU = "LY-GIAY-DEMO-12OZ-XANH";

const tiers = [
  { minQuantity: 20, unitPrice: 1250 },
  { minQuantity: 50, unitPrice: 1150 },
  { minQuantity: 100, unitPrice: 1050 },
];

export const QUOTE_ACCEPTED = {
  id: QUOTE_ID,
  quoteNumber: "QT-20261120-9001",
  customerId: CUSTOMER_ID,
  status: "ACCEPTED",
  revision: 1,
  validUntil: "2099-11-26T03:00:00Z",
  terms: "Giá đã gồm in 2 màu; giao theo đợt trong hợp đồng.",
  requestedDeliveryDate: "2099-12-09",
  legacy: false,
  lines: [
    {
      id: "1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      lineNo: 1,
      measure: "CARTON",
      sku: SKU,
      cartons: 60,
      unitsPerCarton: 1000,
      units: 60000,
      priced: true,
      moq: 20,
      tiers,
      proposedUnitPrice: 1150,
      proposedLineTotal: 69000000,
      acceptedCartons: 60,
      acceptedUnits: 60000,
      acceptedUnitPrice: 1150,
      acceptedLineTotal: 69000000,
      taxClass: "STANDARD",
      taxRate: 10.0,
      proposedTax: 6900000,
      acceptedTax: 6900000,
    },
  ],
  fees: [
    {
      id: "2e3f4051-6b7c-4d8e-9f0a-1b2c3d4e5f60",
      kind: "PLATE_FEE",
      sku: SKU,
      amount: 1500000,
      taxClass: "STANDARD",
      taxRate: 10.0,
      tax: 150000,
    },
  ],
  priced: true,
  proposed: { subtotal: 69000000, fees: 1500000, tax: 7050000, total: 77550000 },
  accepted: { subtotal: 69000000, fees: 1500000, tax: 7050000, total: 77550000 },
  proposedTotal: 77550000,
  acceptedTotal: 77550000,
  sentAt: "2099-11-12T06:00:00Z",
  sentBy: "a1a1a1a1-0000-4000-8000-000000000005",
  respondedAt: "2099-11-13T03:00:00Z",
  respondedBy: "a1a1a1a1-0000-4000-8000-000000000006",
  history: [
    {
      revision: 1,
      toStatus: "DRAFT",
      changedAt: "2099-11-12T03:00:00Z",
      changedBy: "a1a1a1a1-0000-4000-8000-000000000005",
    },
    { revision: 1, fromStatus: "DRAFT", toStatus: "SENT", changedAt: "2099-11-12T06:00:00Z" },
    { revision: 1, fromStatus: "SENT", toStatus: "ACCEPTED", changedAt: "2099-11-13T03:00:00Z" },
  ],
  createdAt: "2099-11-12T03:00:00Z",
  createdBy: "flyway",
  version: 2,
};

/** Bản nháp sau CREATE_QUOTE: phí khuôn hệ thống tự thêm, chưa có tiền (`amount` bị bỏ) → chưa có tổng. */
export const QUOTE_DRAFT_PLATE_UNPRICED = {
  ...QUOTE_ACCEPTED,
  status: "DRAFT",
  lines: [
    {
      ...QUOTE_ACCEPTED.lines[0],
      acceptedCartons: undefined,
      acceptedUnits: undefined,
      acceptedUnitPrice: undefined,
      acceptedLineTotal: undefined,
      acceptedTax: undefined,
    },
  ],
  fees: [
    {
      id: "2e3f4051-6b7c-4d8e-9f0a-1b2c3d4e5f60",
      kind: "PLATE_FEE",
      sku: SKU,
      taxClass: "STANDARD",
      taxRate: 10.0,
    },
  ],
  priced: false,
  proposed: undefined,
  accepted: undefined,
  proposedTotal: undefined,
  acceptedTotal: undefined,
  sentAt: undefined,
  respondedAt: undefined,
  history: [QUOTE_ACCEPTED.history[0]],
  version: 0,
};

export const QUOTE_ROW = {
  id: QUOTE_ID,
  quoteNumber: "QT-20261120-9001",
  customerId: CUSTOMER_ID,
  status: "CONVERTED",
  revision: 1,
  validUntil: "2099-11-26T03:00:00Z",
  sentAt: "2099-11-12T06:00:00Z",
  convertedOrderId: ORDER_ID,
  createdAt: "2099-11-12T03:00:00Z",
  version: 3,
};

export const CUSTOMER = {
  customerId: CUSTOMER_ID,
  fullName: "Khách hàng demo",
  email: "demo.customer@stockflow.local",
  status: "ACTIVE",
};
