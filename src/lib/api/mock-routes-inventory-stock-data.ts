/**
 * Dữ liệu tĩnh cho mock tổng quan tồn kho (SCRUM-438), đúng hình dạng DTO BE develop 0f18f24
 * (StockLevelResponse, WarehouseStockItemResponse, ReservationRowResponse, StockAlertResponse).
 *
 * Một bộ dữ liệu nhất quán, KHÔNG tính toán lúc chạy: số lượng ghi sẵn như BE trả về.
 *   - `reserved` của mỗi dòng tồn = tổng giữ chỗ HELD trên dòng đó.
 *   - Dòng mức tồn theo kho ghi sẵn như BE `levelsOf` cộng dồn (onHand mọi trạng thái; available
 *     và atp chỉ hàng AVAILABLE chưa hết hạn). Mock không tự cộng lại.
 *   - Kho dùng đúng id + mã của danh bạ kho mock (`/warehouses`, mock-data `warehouses`). Id đó
 *     không phải UUID như BE; mã kho là tiền tố mã vị trí (`HN01-A01-01-A`).
 *   - Ngày tháng cố định: `daysToExpiry` của cảnh báo là giá trị tại lúc soạn dữ liệu.
 * Không mô phỏng hàng gia công (BR-PRD-15 BE chưa làm) và không có ngưỡng tồn theo kho.
 */

export const MOCK_STOCK_WAREHOUSES = [
  { warehouseId: "WH-HN-01", code: "HN01" },
  { warehouseId: "WH-HCM-01", code: "HCM01" },
  { warehouseId: "WH-DN-01", code: "DN01" },
] as const;

export interface MockStockRow {
  stockItemId: string;
  sku: string;
  locationCode: string;
  lotNumber: string | null;
  expiryDate: string | null;
  onHand: number;
  reserved: number;
  available: number;
  status: string;
  receivedAt: string | null;
}

export interface MockStockLevel {
  sku: string;
  warehouseCode: string;
  onHand: number;
  available: number;
  reserved: number;
  allocated: number;
  atp: number;
}

export interface MockReservation {
  reservationId: string;
  orderId: string;
  stockItemId: string;
  sku: string;
  locationCode: string;
  lotNumber: string | null;
  quantity: number;
  status: string;
  reservedAt: string;
  expiresAt: string | null;
  releaseReason: string | null;
  closedAt: string | null;
}

export interface MockStockAlert {
  id: string;
  kind: string;
  sku: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  observedQty: number;
  thresholdQty: number | null;
  reservationImpaired: boolean;
  status: string;
  openedAt: string;
  lastObservedAt: string;
  acknowledgedBy: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  ackNote: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  version: number;
}

const id = (n: number) => `0e380000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CUP = "CUP-PP-500";
const LID = "LID-PP-90";

function row(
  n: number,
  sku: string,
  locationCode: string,
  values: Omit<MockStockRow, "stockItemId" | "sku" | "locationCode">,
): MockStockRow {
  return { stockItemId: id(n), sku, locationCode, ...values };
}

export const MOCK_STOCK_ROWS: readonly MockStockRow[] = [
  row(1, CUP, "HN01-A01-01-A", {
    lotNumber: "L2601",
    expiryDate: "2026-11-05",
    onHand: 120,
    reserved: 20,
    available: 100,
    status: "AVAILABLE",
    receivedAt: "2026-08-01T02:00:00Z",
  }),
  row(2, CUP, "HN01-A01-02-B", {
    lotNumber: "L2602",
    expiryDate: "2027-03-01",
    onHand: 200,
    reserved: 0,
    available: 200,
    status: "AVAILABLE",
    receivedAt: "2026-09-10T02:00:00Z",
  }),
  // Quá hạn nhưng còn giữ chỗ: sweep không chặn được (ExpiryPolicy.canBlock) nên vẫn AVAILABLE,
  // còn `available` = 0 vì đã quá hạn dùng.
  row(3, CUP, "HN01-Q01-01-A", {
    lotNumber: "L2599",
    expiryDate: "2026-10-01",
    onHand: 15,
    reserved: 5,
    available: 0,
    status: "AVAILABLE",
    receivedAt: "2026-06-20T02:00:00Z",
  }),
  row(4, CUP, "HN01-R01-01-A", {
    lotNumber: "L2610",
    expiryDate: "2027-06-01",
    onHand: 50,
    reserved: 0,
    available: 0,
    status: "INBOUND",
    receivedAt: "2026-10-15T02:00:00Z",
  }),
  // Không theo lô, không hạn dùng, không có thời điểm nhận: BE bỏ hẳn ba trường này (NON_NULL).
  row(5, CUP, "HN01-A02-01-A", {
    lotNumber: null,
    expiryDate: null,
    onHand: 30,
    reserved: 0,
    available: 30,
    status: "AVAILABLE",
    receivedAt: null,
  }),
  // Dòng rỗng: BE chỉ trả khi includeEmpty=true.
  row(6, CUP, "HN01-A03-01-A", {
    lotNumber: "L2560",
    expiryDate: "2026-12-01",
    onHand: 0,
    reserved: 0,
    available: 0,
    status: "AVAILABLE",
    receivedAt: "2026-05-02T02:00:00Z",
  }),
  // Giữ chỗ hết toàn bộ → ATP kho HCM01 bằng 0 dù còn hàng thực tế.
  row(7, CUP, "HCM01-B01-01-A", {
    lotNumber: "L2605",
    expiryDate: "2027-01-15",
    onHand: 80,
    reserved: 80,
    available: 0,
    status: "AVAILABLE",
    receivedAt: "2026-09-01T02:00:00Z",
  }),
  row(8, CUP, "HCM01-Q01-01-A", {
    lotNumber: "L2605",
    expiryDate: "2027-01-15",
    onHand: 10,
    reserved: 0,
    available: 0,
    status: "QUARANTINE",
    receivedAt: "2026-09-01T02:00:00Z",
  }),
  row(9, LID, "DN01-A01-01-A", {
    lotNumber: null,
    expiryDate: null,
    onHand: 40,
    reserved: 0,
    available: 0,
    status: "DAMAGED",
    receivedAt: "2026-07-07T02:00:00Z",
  }),
  row(10, LID, "DN01-A01-02-A", {
    lotNumber: null,
    expiryDate: null,
    onHand: 25,
    reserved: 5,
    available: 20,
    status: "AVAILABLE",
    receivedAt: "2026-07-07T02:00:00Z",
  }),
  // Quá hạn, không giữ chỗ: sweep đã chuyển sang EXPIRED.
  row(12, CUP, "HN01-Q01-02-A", {
    lotNumber: "L2550",
    expiryDate: "2026-09-15",
    onHand: 8,
    reserved: 0,
    available: 0,
    status: "EXPIRED",
    receivedAt: "2026-05-15T02:00:00Z",
  }),
  row(11, LID, "HN01-A04-01-A", {
    lotNumber: null,
    expiryDate: null,
    onHand: 12,
    reserved: 0,
    available: 0,
    status: "BLOCKED",
    receivedAt: "2026-08-20T02:00:00Z",
  }),
];

export const MOCK_STOCK_LEVELS: readonly MockStockLevel[] = [
  {
    sku: CUP,
    warehouseCode: "HCM01",
    onHand: 90,
    available: 80,
    reserved: 80,
    allocated: 0,
    atp: 0,
  },
  {
    sku: CUP,
    warehouseCode: "HN01",
    onHand: 423,
    available: 350,
    reserved: 25,
    allocated: 0,
    atp: 330,
  },
  {
    sku: LID,
    warehouseCode: "DN01",
    onHand: 65,
    available: 25,
    reserved: 5,
    allocated: 0,
    atp: 20,
  },
  { sku: LID, warehouseCode: "HN01", onHand: 12, available: 0, reserved: 0, allocated: 0, atp: 0 },
];

function hold(
  n: number,
  stock: MockStockRow,
  values: Omit<
    MockReservation,
    "reservationId" | "stockItemId" | "sku" | "locationCode" | "lotNumber"
  >,
): MockReservation {
  return {
    reservationId: id(100 + n),
    stockItemId: stock.stockItemId,
    sku: stock.sku,
    locationCode: stock.locationCode,
    lotNumber: stock.lotNumber,
    ...values,
  };
}

function stockRow(n: number): MockStockRow {
  const found = MOCK_STOCK_ROWS.find((candidate) => candidate.stockItemId === id(n));
  if (!found) throw new Error(`Mock stock row ${n} is missing`);
  return found;
}

const r1 = stockRow(1);
const r2 = stockRow(2);
const r3 = stockRow(3);
const r7 = stockRow(7);
const r10 = stockRow(10);
const open = { releaseReason: null, closedAt: null };

export const MOCK_RESERVATIONS: readonly MockReservation[] = [
  hold(1, r1, {
    orderId: id(201),
    quantity: 20,
    status: "HELD",
    reservedAt: "2026-10-14T02:00:00Z",
    expiresAt: "2026-10-17T02:00:00Z",
    ...open,
  }),
  // Đơn đã thanh toán: giữ chỗ được ghim, `expiresAt` bị bỏ.
  hold(2, r3, {
    orderId: id(202),
    quantity: 5,
    status: "HELD",
    reservedAt: "2026-09-28T02:00:00Z",
    expiresAt: null,
    ...open,
  }),
  hold(3, r7, {
    orderId: id(203),
    quantity: 80,
    status: "HELD",
    reservedAt: "2026-10-15T02:00:00Z",
    expiresAt: null,
    ...open,
  }),
  hold(4, r1, {
    orderId: id(204),
    quantity: 10,
    status: "RELEASED",
    reservedAt: "2026-10-10T02:00:00Z",
    expiresAt: null,
    releaseReason: "PAYMENT_FAILED",
    closedAt: "2026-10-11T02:00:00Z",
  }),
  hold(5, r2, {
    orderId: id(205),
    quantity: 12,
    status: "CONSUMED",
    reservedAt: "2026-10-05T02:00:00Z",
    expiresAt: null,
    ...open,
    closedAt: "2026-10-06T02:00:00Z",
  }),
  hold(6, r10, {
    orderId: id(206),
    quantity: 3,
    status: "EXPIRED",
    reservedAt: "2026-10-01T02:00:00Z",
    expiresAt: "2026-10-02T02:00:00Z",
    releaseReason: "RESERVATION_EXPIRED",
    closedAt: "2026-10-02T02:05:00Z",
  }),
  hold(7, r10, {
    orderId: id(207),
    quantity: 5,
    status: "HELD",
    reservedAt: "2026-10-12T02:00:00Z",
    expiresAt: "2026-10-19T02:00:00Z",
    ...open,
  }),
];

const unacknowledged = {
  acknowledgedBy: null,
  acknowledgedByName: null,
  acknowledgedAt: null,
  ackNote: null,
  resolvedAt: null,
  resolution: null,
};
const skuWide = { warehouseId: null, warehouseCode: null, lotNumber: null, expiryDate: null };

export const MOCK_STOCK_ALERTS: readonly MockStockAlert[] = [
  {
    id: id(301),
    kind: "REORDER",
    sku: CUP,
    ...skuWide,
    daysToExpiry: null,
    observedQty: 430,
    thresholdQty: 500,
    reservationImpaired: false,
    status: "OPEN",
    openedAt: "2026-10-15T01:00:00Z",
    lastObservedAt: "2026-10-16T01:00:00Z",
    ...unacknowledged,
    version: 0,
  },
  {
    id: id(302),
    kind: "SAFETY",
    sku: LID,
    ...skuWide,
    daysToExpiry: null,
    observedQty: 25,
    thresholdQty: 30,
    reservationImpaired: false,
    status: "ACKNOWLEDGED",
    openedAt: "2026-10-12T01:00:00Z",
    lastObservedAt: "2026-10-16T01:00:00Z",
    ...unacknowledged,
    acknowledgedBy: id(401),
    acknowledgedByName: "Quản lý kho mock",
    acknowledgedAt: "2026-10-13T03:00:00Z",
    ackNote: "Đã lên đề nghị mua",
    version: 1,
  },
  {
    id: id(303),
    kind: "EXPIRING",
    sku: CUP,
    warehouseId: "WH-HN-01",
    warehouseCode: "HN01",
    lotNumber: "L2601",
    expiryDate: "2026-11-05",
    daysToExpiry: 20,
    observedQty: 120,
    thresholdQty: null,
    reservationImpaired: false,
    status: "OPEN",
    openedAt: "2026-10-06T17:00:00Z",
    lastObservedAt: "2026-10-15T17:00:00Z",
    ...unacknowledged,
    version: 0,
  },
  {
    id: id(304),
    kind: "EXPIRED",
    sku: CUP,
    warehouseId: "WH-HN-01",
    warehouseCode: "HN01",
    lotNumber: "L2599",
    expiryDate: "2026-10-01",
    daysToExpiry: -15,
    observedQty: 15,
    thresholdQty: null,
    // Lô hết hạn còn giữ chỗ của khách nên không chặn được (ExpiryPolicy.canBlock).
    reservationImpaired: true,
    status: "OPEN",
    openedAt: "2026-10-01T17:00:00Z",
    lastObservedAt: "2026-10-15T17:00:00Z",
    ...unacknowledged,
    version: 0,
  },
  {
    id: id(305),
    kind: "EXPIRING",
    sku: CUP,
    warehouseId: "WH-HCM-01",
    warehouseCode: "HCM01",
    lotNumber: "L2590",
    expiryDate: "2026-10-20",
    daysToExpiry: 4,
    observedQty: 0,
    thresholdQty: null,
    reservationImpaired: false,
    status: "RESOLVED",
    openedAt: "2026-09-20T17:00:00Z",
    lastObservedAt: "2026-10-03T17:00:00Z",
    ...unacknowledged,
    resolvedAt: "2026-10-03T17:00:00Z",
    resolution: "STOCK_GONE",
    version: 2,
  },
];
