/**
 * Logic thuần của mock đóng gói chuyển kho (BE `TransferPackService`, SCRUM-287 PR T, BE PR #164): phiên, dòng của lệnh,
 * kiện (thường, bộ, nguyên thùng), quét, niêm phong, huỷ, hoàn tất. Mỗi hàm sửa trạng thái tại chỗ và ném `PackError`
 * với mã lỗi BE khi vi phạm; route chỉ gọi và đổi lỗi thành response.
 */

import { MOCK_BOXES_PER_UNIT, MOCK_STOCK_CARTONS, mockBarcodeOf } from "./mock-transfer-pack-seed";
import { PackError } from "./mock-packing-session";

import type { MockTransfer } from "./mock-routes-transfer-orders-store";

const DIM_DIVISOR = 5000;

const conflict = (code: string, message: string) => new PackError(409, code, message);
const invalid = (field: string, message: string) =>
  new PackError(400, "VALIDATION_FAILED", message, [{ field, message }]);

export interface MockTransferParcel {
  packageId: string;
  packageNo: number;
  labelCode: string;
  packageType: string;
  status: "OPEN" | "SEALED" | "VOIDED";
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  dimWeightKg?: number;
  rotatable: boolean;
  fragile: boolean;
  sealedAt?: string;
  contents: { transferLineId: string; lotNumber?: string; quantity: number }[];
  kit?: { groupId: string; partNo: number; partCount: number; transferLineId: string };
  kitOverrideReason?: string;
  stockPackageId?: string;
}

export interface MockTransferPack {
  packId: string;
  transferOrderId: string;
  packerId: string;
  packStatus: "PACKING" | "PACKED" | "CANCELLED";
  startedAt: string;
  packedAt?: string;
  parcels: MockTransferParcel[];
  /** `scanId` → kiện đã nhận lần quét (gửi lại cùng id không ghi hai lần). */
  scans: Map<string, string>;
  serial: number;
}

const boxesPerUnit = (sku: string) => MOCK_BOXES_PER_UNIT[sku] ?? 1;
const live = (pack: MockTransferPack) => pack.parcels.filter((p) => p.status !== "VOIDED");

export function packedOf(pack: MockTransferPack, transferLineId: string): number {
  return live(pack).reduce(
    (sum, parcel) =>
      sum +
      parcel.contents
        .filter((content) => content.transferLineId === transferLineId)
        .reduce((inner, content) => inner + content.quantity, 0),
    0,
  );
}

export function newPack(transfer: MockTransfer, packerId: string): MockTransferPack {
  return {
    packId: crypto.randomUUID(),
    transferOrderId: transfer.transferId,
    packerId,
    packStatus: "PACKING",
    startedAt: new Date().toISOString(),
    parcels: [],
    scans: new Map(),
    serial: 0,
  };
}

function nextParcel(
  pack: MockTransferPack,
  transfer: MockTransfer,
  type: string,
): MockTransferParcel {
  pack.serial += 1;
  const rework = pack.parcels.some((p) => p.status === "VOIDED");
  return {
    packageId: crypto.randomUUID(),
    packageNo: pack.serial,
    // BE: đóng lại sau khi huỷ dùng nhãn `PKG-<số lệnh>-R<n>-<k>` vì mã nhãn duy nhất
    labelCode: rework
      ? `PKG-${transfer.number}-R1-${pack.serial}`
      : `PKG-${transfer.number}-${pack.serial}`,
    packageType: type,
    status: "OPEN",
    rotatable: true,
    fragile: false,
    contents: [],
  };
}

const requireWorkable = (pack: MockTransferPack) => {
  if (pack.packStatus !== "PACKING")
    throw conflict("PACK_STATE_CONFLICT", `The packing session is ${pack.packStatus}`);
};

function requirePackageType(type: unknown): string {
  if (type === undefined || type === null || type === "") return "CARTON";
  if (typeof type === "string" && ["CARTON", "BAG", "PALLET", "CRATE", "OTHER"].includes(type))
    return type;
  throw invalid("packageType", "Unknown package type");
}

export function openParcel(
  pack: MockTransferPack,
  transfer: MockTransfer,
  type: unknown,
  kitOverrideReason?: string,
): MockTransferParcel {
  requireWorkable(pack);
  const parcel = nextParcel(pack, transfer, requirePackageType(type));
  if (kitOverrideReason) parcel.kitOverrideReason = kitOverrideReason;
  pack.parcels.push(parcel);
  return parcel;
}

export function openKit(
  pack: MockTransferPack,
  transfer: MockTransfer,
  input: { transferLineId: string; partCount?: number; packageType?: unknown },
) {
  requireWorkable(pack);
  const line = transfer.lines.find((l) => l.lineId === input.transferLineId);
  if (!line) throw invalid("transferLineId", "The line is not on this transfer");
  const parts = boxesPerUnit(line.sku);
  if (parts < 2 || (input.partCount !== undefined && input.partCount !== parts))
    throw new PackError(
      422,
      "KIT_PART_COUNT_MISMATCH",
      "The kit's parts do not match how many boxes the item ships as",
    );
  if (line.requested - packedOf(pack, line.lineId) <= 0)
    throw conflict("PACK_QUANTITY_EXCEEDS_ORDER", "More than the transfer line still wants");
  const type = requirePackageType(input.packageType);
  const groupId = crypto.randomUUID();
  const packages = Array.from({ length: parts }, (_, index) => {
    const parcel = nextParcel(pack, transfer, type);
    parcel.kit = { groupId, partNo: index + 1, partCount: parts, transferLineId: line.lineId };
    pack.parcels.push(parcel);
    return parcel;
  });
  return { groupId, line, packages };
}

/** Dòng của lệnh khớp mã quét theo SKU hoặc mã vạch (không phân biệt hoa thường). */
function linesFor(transfer: MockTransfer, code: string) {
  const wanted = code.trim().toLowerCase();
  return transfer.lines.filter(
    (l) => l.sku.toLowerCase() === wanted || mockBarcodeOf(l.sku).toLowerCase() === wanted,
  );
}

export interface MockScanInput {
  scanId: string;
  scannedCode: string;
  quantity: number;
  lotNumber?: string;
  transferLineId?: string;
  kitOverrideReason?: string;
}

export function applyScan(
  pack: MockTransferPack,
  transfer: MockTransfer,
  packageId: string,
  scan: MockScanInput,
) {
  requireWorkable(pack);
  const parcel = pack.parcels.find((p) => p.packageId === packageId && p.status !== "VOIDED");
  if (!parcel) throw new PackError(404, "PACKAGE_NOT_FOUND", "Package not found");
  const seenIn = pack.scans.get(scan.scanId);
  if (seenIn) {
    if (seenIn !== packageId)
      throw conflict("PACK_SCAN_ID_CONFLICT", "This scan id was already used for another package");
    return;
  }
  if (parcel.status !== "OPEN") throw conflict("PACKAGE_SEALED", "The package is already sealed");
  const candidates = linesFor(transfer, scan.scannedCode);
  const chosen = scan.transferLineId
    ? candidates.find((l) => l.lineId === scan.transferLineId)
    : candidates.length === 1
      ? candidates[0]
      : candidates.filter((l) => l.requested - packedOf(pack, l.lineId) > 0).length === 1
        ? candidates.find((l) => l.requested - packedOf(pack, l.lineId) > 0)
        : undefined;
  if (candidates.length === 0 || (scan.transferLineId && !chosen))
    throw conflict("PACK_ITEM_NOT_IN_ORDER", "This item is not in the transfer order");
  if (!chosen)
    throw conflict("PACK_SCAN_AMBIGUOUS", "This item is on several lines: name the line");
  if (chosen.lotNumber && scan.lotNumber && scan.lotNumber !== chosen.lotNumber)
    throw conflict("PACK_LOT_MISMATCH", "This lot was not picked for this line");
  if (scan.quantity > chosen.requested - packedOf(pack, chosen.lineId))
    throw conflict("PACK_QUANTITY_EXCEEDS_ORDER", "More than the transfer line still wants");
  if (parcel.kit) {
    // KIT_CONTENTS_INVALID: chỉ phần 1 chứa hàng, đúng MỘT đơn vị của dòng bộ
    if (
      parcel.kit.partNo !== 1 ||
      parcel.kit.transferLineId !== chosen.lineId ||
      scan.quantity !== 1
    )
      throw conflict(
        "KIT_CONTENTS_INVALID",
        "Only part 1 of a kit holds goods: one unit of its item",
      );
    if (parcel.contents.length > 0)
      throw conflict(
        "KIT_CONTENTS_INVALID",
        "Only part 1 of a kit holds goods: one unit of its item",
      );
  }
  if (scan.kitOverrideReason) parcel.kitOverrideReason = scan.kitOverrideReason;
  const lot = chosen.lotNumber ?? undefined;
  const existing = parcel.contents.find(
    (c) => c.transferLineId === chosen.lineId && c.lotNumber === lot,
  );
  if (existing) existing.quantity += scan.quantity;
  else
    parcel.contents.push({
      transferLineId: chosen.lineId,
      lotNumber: lot,
      quantity: scan.quantity,
    });
  pack.scans.set(scan.scanId, packageId);
}

export interface MockSealInput {
  weightKg: unknown;
  lengthCm: unknown;
  widthCm: unknown;
  heightCm: unknown;
  packageType?: unknown;
  rotatable?: unknown;
  fragile?: unknown;
  kitOverrideReason?: string;
}

const positive = (field: string, value: unknown): number => {
  if (typeof value !== "number" || !(value > 0)) throw invalid(field, "must be greater than 0");
  return value;
};

export function sealParcel(
  pack: MockTransferPack,
  transfer: MockTransfer,
  packageId: string,
  input: MockSealInput,
) {
  requireWorkable(pack);
  const parcel = pack.parcels.find((p) => p.packageId === packageId && p.status !== "VOIDED");
  if (!parcel) throw new PackError(404, "PACKAGE_NOT_FOUND", "Package not found");
  const weightKg = positive("weightKg", input.weightKg);
  const lengthCm = positive("lengthCm", input.lengthCm);
  const widthCm = positive("widthCm", input.widthCm);
  const heightCm = positive("heightCm", input.heightCm);
  if (parcel.status === "SEALED") throw conflict("PACKAGE_SEALED", "The package is already sealed");
  if (parcel.contents.length === 0 && !(parcel.kit && parcel.kit.partNo > 1))
    throw conflict("PACKAGE_EMPTY", "The package has nothing in it");
  // KIT-FORCE: hàng đi nhiều thùng đóng vào kiện thường phải có lý do
  const needsReason =
    !parcel.kit &&
    parcel.contents.some((c) => {
      const line = transfer.lines.find((l) => l.lineId === c.transferLineId);
      return !!line && boxesPerUnit(line.sku) > 1;
    });
  const reason = input.kitOverrideReason || parcel.kitOverrideReason;
  if (needsReason && !reason)
    throw new PackError(
      422,
      "KIT_OVERRIDE_REASON_REQUIRED",
      "This item ships as a kit: give a reason to pack it in an ordinary package",
    );
  if (reason) parcel.kitOverrideReason = reason;
  Object.assign(parcel, {
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    dimWeightKg: Math.round(((lengthCm * widthCm * heightCm) / DIM_DIVISOR) * 1000) / 1000,
    status: "SEALED",
    sealedAt: new Date().toISOString(),
  });
  if (typeof input.packageType === "string") parcel.packageType = input.packageType;
  if (typeof input.rotatable === "boolean") parcel.rotatable = input.rotatable;
  if (typeof input.fragile === "boolean") parcel.fragile = input.fragile;
  return parcel;
}

/** Huỷ kiện (cả bộ nếu là kiện của bộ): hàng trong kiện tính là chưa đóng. */
export function voidParcel(pack: MockTransferPack, packageId: string) {
  requireWorkable(pack);
  const parcel = pack.parcels.find((p) => p.packageId === packageId && p.status !== "VOIDED");
  if (!parcel) throw new PackError(404, "PACKAGE_NOT_FOUND", "Package not found");
  const group = parcel.kit?.groupId;
  for (const other of pack.parcels) {
    if (other === parcel || (group && other.kit?.groupId === group)) {
      other.status = "VOIDED";
      other.contents = [];
    }
  }
}

/** LP2-8: thùng tồn kho chưa mở giao nguyên — kiện chứa mọi hàng của thùng, số đo gợi ý theo đơn vị đóng gói. */
export function shipCarton(
  pack: MockTransferPack,
  transfer: MockTransfer,
  lpn: string,
  type: unknown,
) {
  requireWorkable(pack);
  const carton = MOCK_STOCK_CARTONS[lpn.trim()];
  if (!carton) throw new PackError(404, "NOT_FOUND", `No stock carton labelled ${lpn}`);
  const line = transfer.lines.find(
    (l) => l.sku === carton.sku && (l.lotNumber ?? null) === (carton.lotNumber ?? null),
  );
  const alreadyShipped = live(pack).some((p) => p.stockPackageId === carton.stockPackageId);
  if (
    !carton.shippable ||
    !line ||
    alreadyShipped ||
    carton.units > line.requested - packedOf(pack, line.lineId)
  )
    throw conflict(
      "STOCK_CARTON_NOT_SHIPPABLE",
      `Carton ${lpn} is not an unopened carton of this transfer`,
    );
  const parcel = nextParcel(pack, transfer, requirePackageType(type));
  parcel.stockPackageId = carton.stockPackageId;
  parcel.contents.push({
    transferLineId: line.lineId,
    lotNumber: line.lotNumber ?? undefined,
    quantity: carton.units,
  });
  pack.parcels.push(parcel);
  return { parcel, carton };
}

/**
 * Hoàn tất: không còn kiện mở có hàng, bộ đủ phần niêm phong, đủ số yêu cầu trừ khi `partial` kèm ghi chú.
 * Chưa trừ tồn: hàng chỉ rời kho khi xe cuối bàn giao.
 */
export function completePack(
  pack: MockTransferPack,
  transfer: MockTransfer,
  input: { partial: boolean; note: string },
) {
  requireWorkable(pack);
  const parcels = live(pack);
  if (parcels.some((p) => p.status === "OPEN" && p.contents.length > 0))
    throw conflict("PACKAGE_NOT_SEALED", "A package is still open: seal it or take it apart");
  if (parcels.some((p) => p.kit && p.status !== "SEALED"))
    throw conflict("KIT_INCOMPLETE", "A kit has parts that are not sealed yet");
  const sealed = parcels.filter((p) => p.status === "SEALED");
  const missing = transfer.lines.some((l) => packedOf(pack, l.lineId) < l.requested);
  if (sealed.length === 0 || (missing && !input.partial))
    throw conflict("PACKING_INCOMPLETE", "Not everything is packed yet");
  if (input.partial && !input.note)
    throw invalid("note", "A note is required with a partial packing");
  pack.packStatus = "PACKED";
  pack.packedAt = new Date().toISOString();
}
