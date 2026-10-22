/**
 * Đóng gói chuyển kho — API layer, khớp BE `TransferPackController` (`/api/v1/fulfillment/transfer-packs`, SCRUM-287
 * PR T, BE PR #164). Base URL của env đã gồm `/api/v1` → path không ghi `v1`. Parse zod một lần tại biên.
 *
 * Cùng bàn đóng gói của đơn (quét kiểm, đóng bộ, cân đo niêm phong, huỷ kiện) nhưng dòng là dòng LỆNH CHUYỂN KHO và có
 * thêm giao nguyên thùng (`cartons`). Mọi lần quét mang `scanId`: gửi lại cùng id thì BE không ghi hai lần.
 */

import { api } from "@/lib/api/client";

import { displayPackStatus } from "./packing-api";
import {
  beTransferCartonSchema,
  beTransferKitSchema,
  beTransferPackSessionSchema,
  beTransferParcelSchema,
} from "./transfer-pack-schemas";

import type {
  CompleteTransferPackInput,
  OpenTransferKitInput,
  OpenTransferPackageInput,
  ScanTransferPackageInput,
  SealTransferPackageInput,
  ShipCartonInput,
  TransferCarton,
  TransferKit,
  TransferPackSession,
  TransferPackSessionDto,
  TransferPackageRef,
  TransferParcel,
} from "./transfer-pack-types";

export const TRANSFER_PACKS_PATH = "/fulfillment/transfer-packs";

const packPath = (packId: string) => `${TRANSFER_PACKS_PATH}/${encodeURIComponent(packId)}`;
const packagePath = ({ packId, packageId }: TransferPackageRef) =>
  `${packPath(packId)}/packages/${encodeURIComponent(packageId)}`;

export function toTransferPackSession(dto: TransferPackSessionDto): TransferPackSession {
  return { ...dto, packStatus: displayPackStatus(dto.packStatus) };
}

const parseSession = (data: unknown): TransferPackSession =>
  toTransferPackSession(beTransferPackSessionSchema.parse(data));

/**
 * Mở phiên đóng gói của lệnh APPROVED / PICKING nguyên chuyến (APPROVED → PICKING). Idempotent: phiên đang mở hoặc đã
 * đóng xong thì được trả nguyên. 409 `TRANSFER_NOT_FULL_TRUCKLOAD`, `INVALID_TRANSFER_TRANSITION`, `PACKING_TAKEN`.
 */
export async function openTransferPack(transferOrderId: string): Promise<TransferPackSession> {
  const { data } = await api.post<unknown>(TRANSFER_PACKS_PATH, { transferOrderId });
  return parseSession(data);
}

export async function getTransferPack(
  packId: string,
  signal?: AbortSignal,
): Promise<TransferPackSession> {
  const { data } = await api.get<unknown>(packPath(packId), { signal });
  return parseSession(data);
}

/** Mở một kiện rỗng (201). */
export async function openTransferPackage({
  packId,
  packageType,
}: OpenTransferPackageInput): Promise<TransferParcel> {
  const { data } = await api.post<unknown>(
    `${packPath(packId)}/packages`,
    packageType ? { packageType } : {},
  );
  return beTransferParcelSchema.parse(data);
}

/** Đóng bộ (LP2-6): các kiện của MỘT đơn vị của dòng đi nhiều thùng. 422 `KIT_PART_COUNT_MISMATCH`. */
export async function openTransferKit({
  packId,
  transferLineId,
  partCount,
  packageType,
}: OpenTransferKitInput): Promise<TransferKit> {
  const { data } = await api.post<unknown>(`${packPath(packId)}/package-kits`, {
    transferLineId,
    partCount: partCount || undefined,
    packageType,
  });
  return beTransferKitSchema.parse(data);
}

/** Một lần quét vào kiện đang mở: SKU / mã vạch, kèm lô khi dòng nêu lô. */
export async function scanIntoTransferPackage({
  packId,
  packageId,
  scan,
}: ScanTransferPackageInput): Promise<TransferPackSession> {
  const { data } = await api.post<unknown>(`${packagePath({ packId, packageId })}/scans`, scan);
  return parseSession(data);
}

/** Cân, đo, niêm phong; kiện nguyên thùng cũng niêm phong bằng số đo thực. 422 `KIT_OVERRIDE_REASON_REQUIRED`. */
export async function sealTransferPackage({
  packId,
  packageId,
  values,
}: SealTransferPackageInput): Promise<TransferParcel> {
  const { data } = await api.post<unknown>(`${packagePath({ packId, packageId })}/seal`, values);
  return beTransferParcelSchema.parse(data);
}

/** Huỷ kiện trước khi rời kho (cả bộ nếu là kiện của bộ): hàng trong kiện tính là chưa đóng. */
export async function voidTransferPackage(ref: TransferPackageRef): Promise<TransferPackSession> {
  const { data } = await api.delete<unknown>(packagePath(ref));
  return parseSession(data);
}

/**
 * LP2-8: giao nguyên một thùng tồn kho chưa mở (quét LPN) — kiện chứa toàn bộ hàng của thùng, kèm số đo gợi ý theo
 * đơn vị đóng gói để người đóng xác nhận. 409 `STOCK_CARTON_NOT_SHIPPABLE`; 404 khi LPN không có.
 */
export async function shipTransferCarton({
  packId,
  lpn,
  packageType,
}: ShipCartonInput): Promise<TransferCarton> {
  const { data } = await api.post<unknown>(`${packPath(packId)}/cartons`, {
    lpn: lpn.trim(),
    packageType,
  });
  return beTransferCartonSchema.parse(data);
}

/**
 * Hoàn tất: mọi kiện đã niêm phong (bộ phải đủ phần) → lệnh sẵn sàng lập kế hoạch xe (`packedAt`). Thiếu so với yêu
 * cầu chỉ khi `partial` kèm ghi chú. Chưa trừ tồn: hàng chỉ rời kho khi xe cuối bàn giao.
 */
export async function completeTransferPack({
  packId,
  partial,
  note,
}: CompleteTransferPackInput): Promise<TransferPackSession> {
  const { data } = await api.post<unknown>(`${packPath(packId)}/completion`, {
    partial,
    note: partial ? note?.trim() : undefined,
  });
  return parseSession(data);
}
