/**
 * Dữ liệu tĩnh cho mock tổng quan tồn kho (SCRUM-438), đúng hình dạng DTO BE develop 0f18f24
 * (StockLevelResponse, WarehouseStockItemResponse, ReservationRowResponse).
 *
 * Một bộ dữ liệu nhất quán, KHÔNG tính toán lúc chạy: số lượng ghi sẵn như BE trả về.
 *   - `reserved` của mỗi dòng tồn = tổng giữ chỗ HELD trên dòng đó.
 *   - Dòng mức tồn theo kho ghi sẵn như BE `levelsOf` cộng dồn (onHand mọi trạng thái; available
 *     và atp chỉ hàng AVAILABLE chưa hết hạn). Mock không tự cộng lại.
 *   - Kho dùng đúng id + mã của danh bạ kho mock (`/warehouses`, mock-data `warehouses`). Id đó
 *     không phải UUID như BE; mã kho là tiền tố mã vị trí (`HN01-A01-01-A`).
 * ADR-0011 (BE step 3e): tồn đếm theo thùng — mỗi dòng tồn là một thùng (`*Cartons` 1 hoặc 0); mức tồn kho ghi sẵn
 * số thùng như BE đếm; mỗi giữ chỗ nằm trên đúng một thùng (`cartons` = 1). `expiresAt` của giữ chỗ đã bỏ (step 3c).
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
  onHandCartons: number;
  reservedCartons: number;
  availableCartons: number;
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
  onHandCartons: number;
  availableCartons: number;
  reservedCartons: number;
  allocatedCartons: number;
  atpCartons: number;
}

export interface MockReservation {
  reservationId: string;
  orderId: string;
  stockItemId: string;
  sku: string;
  locationCode: string;
  lotNumber: string | null;
  quantity: number;
  cartons: number;
  status: string;
  reservedAt: string;
  releaseReason: string | null;
  closedAt: string | null;
}

const id = (n: number) => `0e380000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CUP = "CUP-PP-500";
const LID = "LID-PP-90";

function row(
  n: number,
  sku: string,
  locationCode: string,
  values: Omit<
    MockStockRow,
    | "stockItemId"
    | "sku"
    | "locationCode"
    | "onHandCartons"
    | "reservedCartons"
    | "availableCartons"
  >,
): MockStockRow {
  // Một dòng = một thùng: còn hàng → 1 thùng; thùng có giữ chỗ không còn khả dụng.
  const reserved = values.reserved > 0 ? 1 : 0;
  return {
    stockItemId: id(n),
    sku,
    locationCode,
    ...values,
    onHandCartons: values.onHand > 0 ? 1 : 0,
    reservedCartons: reserved,
    availableCartons: values.available > 0 && !reserved ? 1 : 0,
  };
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
    onHandCartons: 2,
    availableCartons: 1,
    reservedCartons: 1,
    allocatedCartons: 0,
    atpCartons: 0,
  },
  {
    sku: CUP,
    warehouseCode: "HN01",
    onHand: 423,
    available: 350,
    reserved: 25,
    allocated: 0,
    atp: 330,
    onHandCartons: 6,
    availableCartons: 3,
    reservedCartons: 2,
    allocatedCartons: 0,
    atpCartons: 2,
  },
  {
    sku: LID,
    warehouseCode: "DN01",
    onHand: 65,
    available: 25,
    reserved: 5,
    allocated: 0,
    atp: 20,
    onHandCartons: 2,
    availableCartons: 1,
    reservedCartons: 1,
    allocatedCartons: 0,
    atpCartons: 0,
  },
  {
    sku: LID,
    warehouseCode: "HN01",
    onHand: 12,
    available: 0,
    reserved: 0,
    allocated: 0,
    atp: 0,
    onHandCartons: 1,
    availableCartons: 0,
    reservedCartons: 0,
    allocatedCartons: 0,
    atpCartons: 0,
  },
];

function hold(
  n: number,
  stock: MockStockRow,
  values: Omit<
    MockReservation,
    "reservationId" | "stockItemId" | "sku" | "locationCode" | "lotNumber" | "cartons"
  >,
): MockReservation {
  return {
    reservationId: id(100 + n),
    cartons: 1,
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
    ...open,
  }),
  // Đơn đã thanh toán: giữ chỗ được ghim.
  hold(2, r3, {
    orderId: id(202),
    quantity: 5,
    status: "HELD",
    reservedAt: "2026-09-28T02:00:00Z",
    ...open,
  }),
  hold(3, r7, {
    orderId: id(203),
    quantity: 80,
    status: "HELD",
    reservedAt: "2026-10-15T02:00:00Z",
    ...open,
  }),
  hold(4, r1, {
    orderId: id(204),
    quantity: 10,
    status: "RELEASED",
    reservedAt: "2026-10-10T02:00:00Z",
    releaseReason: "PAYMENT_FAILED",
    closedAt: "2026-10-11T02:00:00Z",
  }),
  hold(5, r2, {
    orderId: id(205),
    quantity: 12,
    status: "CONSUMED",
    reservedAt: "2026-10-05T02:00:00Z",
    ...open,
    closedAt: "2026-10-06T02:00:00Z",
  }),
  hold(6, r10, {
    orderId: id(206),
    quantity: 3,
    status: "EXPIRED",
    reservedAt: "2026-10-01T02:00:00Z",
    releaseReason: "RESERVATION_EXPIRED",
    closedAt: "2026-10-02T02:05:00Z",
  }),
  hold(7, r10, {
    orderId: id(207),
    quantity: 5,
    status: "HELD",
    reservedAt: "2026-10-12T02:00:00Z",
    ...open,
  }),
];
