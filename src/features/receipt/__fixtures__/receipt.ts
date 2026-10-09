/**
 * Fixture đúng hình dạng response BE PR #62, số liệu lấy theo seed demo BE
 * (db/demo/V20260929000270__demo_receiving.sql): PO-HCM-DEMO-0002 — 10 SOFA-3S-GREY (2 bước)
 * + 6 TABLE-OAK-160 (3 bước QC, lô + hạn dùng), khu HCM-RCV01 / HCM-QCA01 / HCM-QC01 / HCM-RTV01.
 */

import type { GoodsReceiptApiDto, ReceiptLineDto, ReceivablePo } from "../types";

export const PO_ID = "bd69ad30-f972-2fac-2cef-6f8eef44618c";
export const SOFA_PO_LINE_ID = "931404fb-06e5-d326-c3f5-9e7bf831af8a";
export const TABLE_PO_LINE_ID = "567a8afe-f4b4-aa3f-91d8-fee285876b74";
export const RECEIPT_ID = "0f3a7c1e-9b2d-4e8a-8c51-6d2f9e4b7a10";
const CLERK = "7e1d0c2b-3a4f-4b5c-9d6e-8f7a6b5c4d3e";

export const receivablePo: ReceivablePo = {
  purchaseOrderId: PO_ID,
  poNumber: "PO-HCM-DEMO-0002",
  supplierId: "be4cc8dd-0883-65f5-d979-488ffe0c14b6",
  status: "SENT",
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
  return {
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
    ...overrides,
  };
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
    ...overrides,
  };
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
