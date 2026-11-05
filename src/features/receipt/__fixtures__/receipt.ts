/**
 * Fixture đúng hình dạng response BE PR #62, số liệu lấy theo seed demo BE
 * (db/demo/V20260929000270__demo_receiving.sql): PO-HCM-DEMO-0002 — 10 SOFA-3S-GREY (2 bước)
 * + 6 TABLE-OAK-160 (3 bước QC, lô + hạn dùng), khu HCM-RCV01 / HCM-QCA01 / HCM-QC01 / HCM-RTV01.
 */

import type {
  GoodsReceiptApiDto,
  ReceiptLineDto,
  ReceiptPackageDto,
  ReceiptUnitDto,
  ReceivablePo,
} from "../types";

export const PO_ID = "bd69ad30-f972-2fac-2cef-6f8eef44618c";
export const SOFA_PO_LINE_ID = "931404fb-06e5-d326-c3f5-9e7bf831af8a";
export const TABLE_PO_LINE_ID = "567a8afe-f4b4-aa3f-91d8-fee285876b74";
export const SUPPLIER_ID = "be4cc8dd-0883-65f5-d979-488ffe0c14b6";
export const HCM_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
export const RECEIPT_ID = "0f3a7c1e-9b2d-4e8a-8c51-6d2f9e4b7a10";
const CLERK = "7e1d0c2b-3a4f-4b5c-9d6e-8f7a6b5c4d3e";

export const receivablePo: ReceivablePo = {
  purchaseOrderId: PO_ID,
  poNumber: "PO-HCM-DEMO-0002",
  supplierId: "be4cc8dd-0883-65f5-d979-488ffe0c14b6",
  status: "CONFIRMED",
  expectedAt: "2026-10-15",
  lines: [
    {
      lineId: SOFA_PO_LINE_ID,
      sku: "SOFA-3S-GREY",
      description: "SOFA-3S-GREY",
      quantityOrdered: 10,
      quantityReceived: 0,
      openQuantity: 10,
    },
    {
      lineId: TABLE_PO_LINE_ID,
      sku: "TABLE-OAK-160",
      description: "TABLE-OAK-160",
      quantityOrdered: 6,
      quantityReceived: 0,
      openQuantity: 6,
    },
  ],
};

export function apiLine(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  const quantity = overrides.quantity ?? 6;
  const inCartons = (overrides.packages ?? []).reduce((sum, p) => sum + p.receivedQty, 0);
  return {
    unitOfMeasure: null,
    looseQuantity: quantity - inCartons,
    packages: [],
    units: [],
    orderedUnitOfMeasure: null,
    id: "a1b2c3d4-0000-4000-8000-000000000001",
    purchaseOrderLineId: TABLE_PO_LINE_ID,
    purchaseOrderLineNo: 2,
    inventoryItemId: "2cdf6e40-fbc3-aa6b-3f79-42b5c07d7e41",
    sku: "TABLE-OAK-160",
    quantity: 6,
    lotNumber: "LOT-2026-10",
    expiryDate: "2027-10-01",
    locationCode: "HCM-RCV01",
    note: null,
    qcRequired: true,
    qcProgress: "AWAITING_MOVE_TO_QC",
    qcLocationCode: null,
    movedToQcAt: null,
    quantityForPutaway: 0,
    inspections: [],
    warnings: [],
    ...overrides,
  };
}

/** Đơn vị của mặt hàng như BE trả trên dòng (`units[]`): đơn vị cơ sở trước, rồi theo mã. */
export const CARTON_UNITS: ReceiptUnitDto[] = [
  { unitOfMeasure: "PCS", factor: 1, base: true, active: true, defaultPurchase: false },
  { unitOfMeasure: "CARTON", factor: 1000, base: false, active: true, defaultPurchase: true },
  { unitOfMeasure: "PACK", factor: 10, base: false, active: true, defaultPurchase: false },
];

export function cartonPackage(overrides: Partial<ReceiptPackageDto> = {}): ReceiptPackageDto {
  return {
    id: "c0000000-0000-4000-8000-000000000001",
    lpn: "LPN-20261024-000001",
    quantity: 1000,
    receivedQty: 1000,
    nominalQty: 1000,
    status: "RECEIVING",
    locationCode: "HCM-RCV01",
    ...overrides,
  };
}

/**
 * Ví dụ của issue #104 / BE spec SCRUM-473 §3: dòng 4.990 đơn vị, thùng `…001` (1.000) và `…002` (980),
 * phần lẻ 3.010, đếm theo CARTON (PO line đặt theo CARTON).
 */
export function cartonLine(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  return apiLine({
    quantity: 4990,
    unitOfMeasure: "CARTON",
    orderedUnitOfMeasure: "CARTON",
    units: CARTON_UNITS,
    packages: [
      cartonPackage(),
      cartonPackage({
        id: "c0000000-0000-4000-8000-000000000002",
        lpn: "LPN-20261024-000002",
        quantity: 980,
        receivedQty: 980,
      }),
    ],
    ...overrides,
  });
}

export function apiReceipt(overrides: Partial<GoodsReceiptApiDto> = {}): GoodsReceiptApiDto {
  return {
    id: RECEIPT_ID,
    number: "GR-20261009-0001",
    purchaseOrderId: PO_ID,
    purchaseOrderNumber: "PO-HCM-DEMO-0002",
    warehouseId: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
    status: "DRAFT",
    deliveryNote: "DN-001",
    note: null,
    // 23:30 ngày 08/10 theo UTC = 06:30 ngày 09/10 giờ VN
    receivedAt: "2026-10-08T23:30:00Z",
    receivedBy: CLERK,
    confirmedAt: null,
    confirmedBy: null,
    closedAt: null,
    lines: [],
    warnings: [],
    approval: null,
    withoutPurchaseOrder: false,
    ...overrides,
  };
}

/** Phiếu hàng về KHÔNG có PO (BR-RCP-002): NCC + lý do của chính phiếu, dòng gọi hàng bằng SKU. */
export function apiBlindReceipt(overrides: Partial<GoodsReceiptApiDto> = {}): GoodsReceiptApiDto {
  return apiReceipt({
    purchaseOrderId: null,
    purchaseOrderNumber: null,
    supplierId: SUPPLIER_ID,
    supplierName: "Xưởng gỗ Việt",
    withoutPurchaseOrder: true,
    blindReason: "NCC tặng kèm hàng mẫu",
    ...overrides,
  });
}

export function apiReceiptPage(items = [apiReceipt()]) {
  return {
    items: items.map(
      ({ lines: _lines, purchaseOrderNumber: _po, note: _note, confirmedBy: _by, ...row }) => row,
    ),
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}
