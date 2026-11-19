/**
 * Fixture đúng hình dạng `GoodsReceiptResponse` / `GoodsReceiptRowResponse` của BE sau 4A-5 / 4A-9: phiếu theo Đơn
 * sản xuất (`PRODUCTION`) có Đơn sản xuất + đơn vị sản xuất + tiến độ thùng theo dòng; phiếu mua hàng cũ
 * (`PURCHASE`) không có Đơn sản xuất. Khu nhận HCM-RCV01 của kho HCM (seed demo BE).
 */

import type {
  GoodsReceiptApiDto,
  ProductionLineProgressDto,
  ReceiptLineDto,
  ReceiptPackageDto,
  ReceiptUnitDto,
} from "../types";

export const HCM_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
export const RECEIPT_ID = "0f3a7c1e-9b2d-4e8a-8c51-6d2f9e4b7a10";
export const PRODUCTION_ORDER_ID = "5b1e2f3a-7c4d-4e8a-9b0c-1d2e3f4a5b6c";
export const PRODUCTION_ORDER_LINE_ID = "6c2f3a4b-8d5e-4f9a-8c1d-2e3f4a5b6c7d";
export const PRODUCER_ID = "7d3a4b5c-9e6f-4a0b-9d2e-3f4a5b6c7d8e";
const CLERK = "7e1d0c2b-3a4f-4b5c-9d6e-8f7a6b5c4d3e";

/** 10 thùng × 50 ly đặt; đã nhận 4 thùng ở phiếu trước, phiếu này 2 thùng, còn 4. */
export function productionProgress(
  overrides: Partial<ProductionLineProgressDto> = {},
): ProductionLineProgressDto {
  return {
    unitsPerCarton: 50,
    orderedCartons: 10,
    receivedCartons: 4,
    thisReceiptCartons: 2,
    remainingCartons: 4,
    orderedUnits: 500,
    receivedUnits: 200,
    thisReceiptUnits: 100,
    remainingUnits: 200,
    ...overrides,
  };
}

export function apiLine(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  const quantity = overrides.quantity ?? 100;
  const inCartons = (overrides.packages ?? []).reduce((sum, p) => sum + p.receivedQty, 0);
  return {
    unitOfMeasure: null,
    looseQuantity: quantity - inCartons,
    packages: [],
    units: [],
    id: "a1b2c3d4-0000-4000-8000-000000000001",
    inventoryItemId: "2cdf6e40-fbc3-aa6b-3f79-42b5c07d7e41",
    sku: "CUP-PRINT-ACME-12OZ",
    quantity: 100,
    lotNumber: "PO-HCM-0007",
    locationCode: "HCM-RCV01",
    note: null,
    quantityForPutaway: 0,
    warnings: [],
    productionOrderLineId: PRODUCTION_ORDER_LINE_ID,
    production: productionProgress(),
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
 * phần lẻ 3.010, đếm theo CARTON.
 */
export function cartonLine(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  return apiLine({
    quantity: 4990,
    unitOfMeasure: "CARTON",
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

/** Phiếu theo Đơn sản xuất (docs 03 §4.1). */
export function apiReceipt(overrides: Partial<GoodsReceiptApiDto> = {}): GoodsReceiptApiDto {
  return {
    id: RECEIPT_ID,
    number: "GR-20261009-0001",
    warehouseId: HCM_ID,
    warehouseCode: "HCM",
    warehouseName: "Kho Hồ Chí Minh",
    status: "DRAFT",
    deliveryNote: "DN-001",
    note: null,
    // 23:30 ngày 08/10 theo UTC = 06:30 ngày 09/10 giờ VN
    receivedAt: "2026-10-08T23:30:00Z",
    receivedBy: CLERK,
    receivedByName: "Nguyễn Văn Kho",
    confirmedAt: null,
    confirmedBy: null,
    confirmedByName: null,
    closedAt: null,
    lines: [],
    warnings: [],
    receiptType: "PRODUCTION",
    productionOrderId: PRODUCTION_ORDER_ID,
    productionOrderCode: "PO-HCM-0007",
    productionOrderStatus: "IN_PRODUCTION",
    producerId: PRODUCER_ID,
    producerName: "Xưởng in Ánh Dương",
    ...overrides,
  };
}

/** Phiếu mua hàng cũ (BE 4A-8): không có Đơn sản xuất, chỉ còn đọc và huỷ khi còn nháp. */
export function apiPurchaseReceipt(
  overrides: Partial<GoodsReceiptApiDto> = {},
): GoodsReceiptApiDto {
  return apiReceipt({
    receiptType: "PURCHASE",
    productionOrderId: null,
    productionOrderCode: null,
    productionOrderStatus: null,
    producerId: null,
    producerName: null,
    lines: [apiLine({ productionOrderLineId: null, production: null })],
    ...overrides,
  });
}

/** `GoodsReceiptRowResponse`: dòng danh sách, không kèm dòng nhận. */
export function apiReceiptRow(receipt: GoodsReceiptApiDto = apiReceipt()) {
  const {
    lines: _lines,
    note: _note,
    warnings: _warnings,
    productionOrderStatus: _poStatus,
    producerId: _producerId,
    ...row
  } = receipt;
  return row;
}

export function apiReceiptPage(items = [apiReceipt()]) {
  return {
    items: items.map((receipt) => apiReceiptRow(receipt)),
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}
