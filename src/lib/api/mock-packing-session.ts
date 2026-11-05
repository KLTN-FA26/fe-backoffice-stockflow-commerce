/**
 * Mock trạm đóng gói — luật của một phiên đóng gói, chép từ BE `PackingSession` (PR #136, docs 08).
 * Thuần: không đọc order / store / auth; lỗi ném `PackError` (route đổi thành `errorCode` BE).
 */

import type { MockFieldError } from "./mock-routes-purchase-orders-store";

export const MAX_UNITS_PER_SCAN = 1_000_000;
/** BE `stockflow.fulfillment.packing.dim-divisor` (mặc định 6000): quy đổi cm³ → kg. */
const DIM_DIVISOR = 6000;

export class PackError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: MockFieldError[] = [],
  ) {
    super(message);
  }
}

const conflict = (code: string, message: string, fields: MockFieldError[] = []) =>
  new PackError(409, code, message, fields);
const invalid = (message: string, field: string, detail: string) =>
  new PackError(400, "VALIDATION_FAILED", message, [{ field, message: detail }]);

export interface PackLineState {
  orderLineId: string;
  sku: string;
  barcode: string;
  printLine: boolean;
  designSnapshotId?: string;
  wanted: number;
  available: number;
  /** Lô đã lấy cho dòng (rỗng = không theo lô). */
  lots: Record<string, number>;
  /** Serial đã lấy cho dòng (rỗng = không theo serial). */
  serials: string[];
  unitPrice: number;
}

export interface ParcelContent {
  orderLineId: string;
  lotNumber?: string;
  serialNumber?: string;
  quantity: number;
}

export interface ParcelState {
  packageId: string;
  packageNo: number;
  labelCode: string;
  packageType: string;
  status: "OPEN" | "SEALED" | "VOIDED";
  shipmentId?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  dimWeightKg?: number;
  rotatable: boolean;
  rotatableOverridden: boolean;
  fragile: boolean;
  fragileOverridden: boolean;
  sealedAt?: string;
  contents: ParcelContent[];
}

export interface ShipmentState {
  shipmentId: string;
  code: string;
  status: string;
  packageCount: number;
  codAmount: number;
  /** Giá trị hàng của lô — để chia tiền đã trả trước cho các lô theo thứ tự tạo. */
  value: number;
  partial: boolean;
  partialNote?: string;
  readyAt: string;
  requestId?: string;
}

export interface PackSessionState {
  taskId: string;
  orderNumber: string;
  packerId?: string;
  packerName?: string;
  startedAt?: string;
  packedAt?: string;
  lines: PackLineState[];
  parcels: ParcelState[];
  shipments: ShipmentState[];
  /** scanId → kiện đã ghi lần quét / bớt đó (BE `package_scan`, append-only). */
  scans: Map<string, string>;
  /** `requestId` của lần hoàn tất bị giữ do lệch thiết kế. */
  heldRequestId?: string;
}

const same = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const blank = (value: string | undefined) => !value || value.trim() === "";

const liveParcels = (s: PackSessionState) => s.parcels.filter((p) => p.status !== "VOIDED");

export function packedOf(s: PackSessionState, orderLineId: string): number {
  return liveParcels(s)
    .flatMap((p) => p.contents)
    .filter((c) => c.orderLineId === orderLineId)
    .reduce((sum, c) => sum + c.quantity, 0);
}

export function shippedOf(s: PackSessionState, orderLineId: string): number {
  return s.parcels
    .filter((p) => p.status !== "VOIDED" && p.shipmentId)
    .flatMap((p) => p.contents)
    .filter((c) => c.orderLineId === orderLineId)
    .reduce((sum, c) => sum + c.quantity, 0);
}

function requireParcel(s: PackSessionState, packageId: string): ParcelState {
  const parcel = s.parcels.find((p) => p.packageId === packageId);
  if (!parcel) throw new PackError(404, "PACKAGE_NOT_FOUND", "Package not found");
  return parcel;
}

function requireOpen(s: PackSessionState, packageId: string): ParcelState {
  const parcel = requireParcel(s, packageId);
  if (parcel.status === "SEALED") {
    throw conflict("PACKAGE_SEALED", `Package ${parcel.packageNo} is sealed: re-open it first`);
  }
  if (parcel.status === "VOIDED") {
    throw conflict("PACK_STATE_CONFLICT", `Package ${parcel.packageNo} was voided`);
  }
  return parcel;
}

function requireNotShipped(parcel: ParcelState): void {
  if (parcel.shipmentId) {
    throw conflict("PACKAGE_SHIPPED", `Package ${parcel.packageNo} is in a shipment already`);
  }
}

function requireUnits(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_UNITS_PER_SCAN) {
    throw invalid(
      `A scan moves between 1 and ${MAX_UNITS_PER_SCAN} units`,
      "quantity",
      `must be between 1 and ${MAX_UNITS_PER_SCAN}`,
    );
  }
}

/** Dòng của đơn theo mã quét (BE `lineFor`): một dòng → dòng đó; nhiều dòng → dòng DUY NHẤT còn thiếu. */
function lineFor(
  s: PackSessionState,
  code: string,
  orderLineId: string | undefined,
): PackLineState {
  const matching = s.lines.filter((l) => same(code, l.sku) || same(code, l.barcode));
  if (orderLineId) {
    const named = s.lines.find((l) => l.orderLineId === orderLineId);
    if (!named || !matching.includes(named)) {
      throw conflict("PACK_ITEM_NOT_IN_ORDER", `Scanned ${code.trim()}; that line is not it`);
    }
    return named;
  }
  const [first] = matching;
  if (!first) {
    throw conflict("PACK_ITEM_NOT_IN_ORDER", `${code.trim()} is not on order ${s.orderNumber}`);
  }
  if (matching.length === 1) return first;
  const open = matching.filter((l) => packedOf(s, l.orderLineId) < l.wanted);
  const [only] = open;
  if (open.length === 1 && only) return only;
  throw conflict(
    "PACK_SCAN_AMBIGUOUS",
    `${code.trim()} is on ${matching.length} lines: name the line`,
    [{ field: "orderLineId", message: `one of ${matching.map((l) => l.orderLineId).join(", ")}` }],
  );
}

function checkLot(s: PackSessionState, line: PackLineState, lot: string | undefined, qty: number) {
  const known = Object.keys(line.lots);
  if (known.length === 0) {
    if (!blank(lot))
      throw conflict("PACK_LOT_MISMATCH", `${line.sku} has no lot; scanned lot ${lot}`);
    return undefined;
  }
  if (blank(lot)) {
    throw invalid(
      `${line.sku} is tracked by lot: scan the lot`,
      "lotNumber",
      `required for ${line.sku}`,
    );
  }
  const match = known.find((k) => same(lot, k));
  if (!match) throw conflict("PACK_LOT_MISMATCH", `Lot ${lot} was not picked for ${line.sku}`);
  const packedOfLot = liveParcels(s)
    .flatMap((p) => p.contents)
    .filter((c) => c.orderLineId === line.orderLineId && c.lotNumber === match)
    .reduce((sum, c) => sum + c.quantity, 0);
  if (packedOfLot + qty > (line.lots[match] ?? 0)) {
    throw conflict(
      "PACK_LOT_MISMATCH",
      `${line.lots[match]} of lot ${match} were picked; ${packedOfLot} packed`,
    );
  }
  return match;
}

function checkSerial(
  s: PackSessionState,
  line: PackLineState,
  serial: string | undefined,
  qty: number,
) {
  if (line.serials.length === 0) {
    if (!blank(serial)) throw conflict("PACK_SERIAL_MISMATCH", `${line.sku} has no serial numbers`);
    return undefined;
  }
  if (blank(serial) || qty !== 1) {
    throw invalid(
      `${line.sku} is tracked by serial: scan each unit`,
      "serialNumber",
      "required, one unit per scan",
    );
  }
  const match = line.serials.find((k) => same(serial, k));
  if (!match)
    throw conflict("PACK_SERIAL_MISMATCH", `Serial ${serial} was not picked for ${line.sku}`);
  const packed = liveParcels(s).some((p) => p.contents.some((c) => c.serialNumber === match));
  if (packed) throw conflict("PACK_SERIAL_MISMATCH", `Serial ${match} is packed already`);
  return match;
}

export interface MockScanInput {
  scanId: string;
  packageId: string;
  scannedCode: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
  orderLineId?: string;
}

/** Một lần quét vào kiện đang mở (BE `scan`). Cùng `scanId` + cùng kiện → không đổi gì (200). */
export function applyScan(s: PackSessionState, input: MockScanInput): void {
  const seen = s.scans.get(input.scanId);
  if (seen) {
    if (seen === input.packageId) return;
    throw conflict("PACK_SCAN_ID_CONFLICT", "This scan id was already used for another package");
  }
  requireUnits(input.quantity);
  const parcel = requireOpen(s, input.packageId);
  if (blank(input.scannedCode)) {
    throw invalid("Scan the item's SKU or barcode", "scannedCode", "must not be blank");
  }
  const line = lineFor(s, input.scannedCode, input.orderLineId);
  const packed = packedOf(s, line.orderLineId);
  if (packed + input.quantity > line.wanted) {
    throw conflict(
      "PACK_QUANTITY_EXCEEDS_ORDER",
      `Line ${line.sku} wants ${line.wanted}; ${packed} packed`,
      [{ field: "quantity", message: `at most ${line.wanted - packed}` }],
    );
  }
  if (packed + input.quantity > line.available) {
    throw conflict(
      "PACK_QUANTITY_EXCEEDS_PICKED",
      `${line.available} of ${line.sku} reached packing`,
      [{ field: "quantity", message: `at most ${Math.max(0, line.available - packed)}` }],
    );
  }
  const lotNumber = checkLot(s, line, input.lotNumber, input.quantity);
  const serialNumber = checkSerial(s, line, input.serialNumber, input.quantity);
  const held = parcel.contents.find(
    (c) =>
      c.orderLineId === line.orderLineId &&
      c.lotNumber === lotNumber &&
      c.serialNumber === serialNumber,
  );
  if (held) held.quantity += input.quantity;
  else
    parcel.contents.push({
      orderLineId: line.orderLineId,
      lotNumber,
      serialNumber,
      quantity: input.quantity,
    });
  s.scans.set(input.scanId, parcel.packageId);
}

export interface MockRemoveInput {
  scanId: string;
  packageId: string;
  orderLineId: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
}

/** Bớt hàng khỏi kiện đang mở (BE `remove`). */
export function applyRemove(s: PackSessionState, input: MockRemoveInput): void {
  if (s.scans.has(input.scanId)) return;
  requireUnits(input.quantity);
  const parcel = requireOpen(s, input.packageId);
  const keys = parcel.contents.filter(
    (c) =>
      c.orderLineId === input.orderLineId &&
      (blank(input.lotNumber) || same(input.lotNumber, c.lotNumber)) &&
      (blank(input.serialNumber) || same(input.serialNumber, c.serialNumber)),
  );
  const [key] = keys;
  if (!key)
    throw conflict("PACK_STATE_CONFLICT", `Package ${parcel.packageNo} holds none of that line`);
  if (keys.length > 1) {
    throw invalid(
      "The package holds that line under several lots: name the one to take out",
      "lotNumber",
      "required",
    );
  }
  if (input.quantity > key.quantity) {
    throw conflict(
      "PACK_STATE_CONFLICT",
      `Package ${parcel.packageNo} holds ${key.quantity} of that line`,
    );
  }
  key.quantity -= input.quantity;
  parcel.contents = parcel.contents.filter((c) => c.quantity > 0);
  s.scans.set(input.scanId, parcel.packageId);
}

export function openParcel(
  s: PackSessionState,
  packageId: string,
  packageType: string,
): ParcelState {
  const next = s.parcels.reduce((max, p) => Math.max(max, p.packageNo), 0) + 1;
  const parcel: ParcelState = {
    packageId,
    packageNo: next,
    labelCode: `PKG-${s.orderNumber}-${next}`,
    packageType,
    status: "OPEN",
    rotatable: true,
    rotatableOverridden: false,
    fragile: false,
    fragileOverridden: false,
    contents: [],
  };
  s.parcels.push(parcel);
  return parcel;
}

export interface MockSealInput {
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  packageType?: string;
  rotatable?: boolean;
  fragile?: boolean;
}

/** Cân, đo, niêm phong (BE `seal`): số đo > 0 bắt buộc; cờ mặc định từ SKU (mock: xoay được, không dễ vỡ). */
export function sealParcel(
  s: PackSessionState,
  packageId: string,
  input: MockSealInput,
  now: string,
) {
  const parcel = requireParcel(s, packageId);
  if (parcel.status === "SEALED") {
    throw conflict("PACKAGE_SEALED", `Package ${parcel.packageNo} is sealed`);
  }
  requireOpen(s, packageId);
  if (parcel.contents.length === 0) {
    throw conflict("PACKAGE_EMPTY", `Package ${parcel.packageNo} has nothing in it`);
  }
  const fields = (["weightKg", "lengthCm", "widthCm", "heightCm"] as const)
    .filter((key) => !(typeof input[key] === "number" && input[key] > 0))
    .map((field) => ({ field, message: "must be greater than 0" }));
  if (fields.length > 0) {
    throw new PackError(
      400,
      "VALIDATION_FAILED",
      "A package is sealed with its real weight and size",
      fields,
    );
  }
  const { weightKg = 0, lengthCm = 0, widthCm = 0, heightCm = 0 } = input;
  parcel.rotatable = input.rotatable ?? true;
  parcel.rotatableOverridden = parcel.rotatable !== true;
  parcel.fragile = input.fragile ?? false;
  parcel.fragileOverridden = parcel.fragile !== false;
  if (input.packageType) parcel.packageType = input.packageType;
  Object.assign(parcel, { weightKg, lengthCm, widthCm, heightCm });
  parcel.dimWeightKg = Math.max(
    0.001,
    Math.round(((lengthCm * widthCm * heightCm) / DIM_DIVISOR) * 1000) / 1000,
  );
  parcel.status = "SEALED";
  parcel.sealedAt = now;
  return parcel;
}

export function reopenParcel(s: PackSessionState, packageId: string): ParcelState {
  const parcel = requireParcel(s, packageId);
  requireNotShipped(parcel);
  if (parcel.status === "OPEN") return parcel;
  if (parcel.status === "VOIDED") {
    throw conflict("PACK_STATE_CONFLICT", `Package ${parcel.packageNo} was voided`);
  }
  parcel.status = "OPEN";
  parcel.sealedAt = undefined;
  return parcel;
}

export function voidParcel(s: PackSessionState, packageId: string): void {
  const parcel = requireParcel(s, packageId);
  if (parcel.status === "VOIDED") return;
  requireNotShipped(parcel);
  parcel.status = "VOIDED";
}

export interface MockCompletion {
  parcels: ParcelState[];
  lineTotals: Map<string, number>;
  partial: boolean;
}

/** Điều kiện hoàn tất (BE `complete`): kiện mở có hàng chặn; cần kiện niêm phong; đủ hàng hoặc giao một phần kèm lý do. */
export function planCompletion(
  s: PackSessionState,
  partialRequested: boolean,
  note: string | undefined,
) {
  const open = liveParcels(s).filter((p) => p.status === "OPEN" && p.contents.length > 0);
  if (open.length > 0) {
    throw conflict(
      "PACKAGE_NOT_SEALED",
      `Package(s) ${open.map((p) => p.packageNo).join(", ")} still open`,
    );
  }
  const toShip = liveParcels(s).filter((p) => p.status === "SEALED" && !p.shipmentId);
  if (toShip.length === 0)
    throw conflict("PACK_NOTHING_TO_SHIP", "No sealed package is waiting to ship");
  const missing = s.lines.filter((l) => packedOf(s, l.orderLineId) < l.wanted);
  if (missing.length > 0) {
    if (!partialRequested) {
      throw conflict(
        "PACKING_INCOMPLETE",
        `Not everything is packed: ${missing.map((l) => `${l.sku} ${packedOf(s, l.orderLineId)} of ${l.wanted}`).join(", ")}`,
        missing.map((l) => ({
          field: `lines[${l.orderLineId}]`,
          message: `${packedOf(s, l.orderLineId)} of ${l.wanted} packed`,
        })),
      );
    }
    if (blank(note)) {
      throw invalid("A partial shipment says why", "note", "required for a partial shipment");
    }
  }
  const lineTotals = new Map<string, number>();
  for (const parcel of toShip) {
    for (const c of parcel.contents) {
      lineTotals.set(c.orderLineId, (lineTotals.get(c.orderLineId) ?? 0) + c.quantity);
    }
  }
  s.parcels
    .filter((p) => p.status === "OPEN" && p.contents.length === 0)
    .forEach((p) => (p.status = "VOIDED"));
  return { parcels: toShip, lineTotals, partial: missing.length > 0 } satisfies MockCompletion;
}
