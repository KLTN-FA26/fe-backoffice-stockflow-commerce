/**
 * Trạm đóng gói — API layer, khớp BE `PackingController` + `POST /tasks/{id}/packing-completion`
 * (BE PR #136, SCRUM-278/281/282). Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 *
 * Mọi lần quét và bớt hàng mang `scanId`: gửi lại cùng id (sau lỗi mạng) thì BE trả 200 mà không đổi
 * gì. Hoàn tất đóng gói mang `requestId` với cùng ý nghĩa. Parse zod một lần tại biên.
 */

import { PACK_API_STATUSES, PACK_STATUS_BY_API, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { toFulfillmentTask } from "./api";
import {
  bePackageLabelSchema,
  bePackageSchema,
  bePackingQueuePageSchema,
  bePackingSessionSchema,
} from "./packing-schemas";
import { beFulfillmentTaskSchema } from "./schemas";

import type { PackApiStatus } from "@/constants";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CompletePackingInput,
  OpenPackageInput,
  PackPackage,
  PackageLabel,
  PackageRef,
  PackingQueueParams,
  PackingQueueRow,
  PackingSession,
  PackingSessionDto,
  RemoveUnitsInput,
  ScanPackageInput,
  SealPackageInput,
  SessionPackStatus,
} from "./packing-types";
import type { FulfillmentTask } from "./types";

const FULFILLMENT_PATH = "/fulfillment";
const QUEUE_PATH = `${FULFILLMENT_PATH}/packing-queue`;
const IDEMPOTENCY_HEADER = "Idempotency-Key";

const taskPath = (taskId: string) => `${FULFILLMENT_PATH}/tasks/${encodeURIComponent(taskId)}`;
const packagePath = ({ taskId, packageId }: PackageRef) =>
  `${taskPath(taskId)}/packages/${encodeURIComponent(packageId)}`;

/** `PackStatus` BE → tên hiển thị; giá trị lạ (đã được schema đổi thành UNKNOWN) → "Unknown". */
export function displayPackStatus(status: string): SessionPackStatus {
  const known = PACK_API_STATUSES.find(
    (candidate): candidate is PackApiStatus => candidate === status,
  );
  return known ? PACK_STATUS_BY_API[known] : "Unknown";
}

export function toPackingSession(dto: PackingSessionDto): PackingSession {
  return { ...dto, packStatus: displayPackStatus(dto.packStatus) };
}

const parseSession = (data: unknown): PackingSession =>
  toPackingSession(bePackingSessionSchema.parse(data));

/* ── Hàng chờ ────────────────────────────────────────────────────────── */

/**
 * Đơn đã lấy hàng xong chờ ở bàn đóng gói, cũ nhất trước; chỉ các kho người gọi được xem. Bỏ trống
 * `status` = đang chờ (PENDING, PACKING, ON_HOLD).
 */
export async function listPackingQueue(
  params: PackingQueueParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PackingQueueRow>> {
  const { data } = await api.get<unknown>(QUEUE_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      warehouseId: params.warehouseId || undefined,
      status: params.status || undefined,
    },
    signal,
  });
  const page = bePackingQueuePageSchema.parse(data);
  return {
    ...page,
    items: page.items.map((row) => ({ ...row, packStatus: displayPackStatus(row.packStatus) })),
  };
}

/* ── Phiên đóng gói ──────────────────────────────────────────────────── */

export async function getPackingSession(
  taskId: string,
  signal?: AbortSignal,
): Promise<PackingSession> {
  const { data } = await api.get<unknown>(`${taskPath(taskId)}/packing-session`, { signal });
  return parseSession(data);
}

/**
 * Packer nhận đơn tại bàn đóng gói (PENDING → PACKING). Gọi lại bởi chính người đó thì trả nguyên
 * phiên; người khác nhận trước → 409 `PACKING_TAKEN` (quản lý kho thì không bị chặn); 409
 * `PACKING_NOT_READY` khi lấy hàng chưa xong.
 */
export async function startPacking(taskId: string): Promise<PackingSession> {
  const { data } = await api.post<unknown>(`${taskPath(taskId)}/packing-start`);
  return parseSession(data);
}

/* ── Kiện ────────────────────────────────────────────────────────────── */

/** Mở một kiện rỗng (201). Mỗi lần gọi mở thêm một kiện → gửi `Idempotency-Key` để gửi lại an toàn. */
export async function openPackage({
  taskId,
  packageType,
  idempotencyKey,
}: OpenPackageInput): Promise<PackPackage> {
  const { data } = await api.post<unknown>(
    `${taskPath(taskId)}/packages`,
    packageType ? { packageType } : {},
    { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } },
  );
  return bePackageSchema.parse(data);
}

/** Một lần quét vào kiện đang mở (docs 08 bước 2): SKU / mã vạch, kèm lô hoặc serial khi hàng theo dõi. */
export async function scanIntoPackage({
  taskId,
  packageId,
  scan,
}: ScanPackageInput): Promise<PackingSession> {
  const { data } = await api.post<unknown>(`${packagePath({ taskId, packageId })}/scans`, scan);
  return parseSession(data);
}

/** Lấy `quantity` đơn vị của một dòng ra khỏi kiện đang mở. */
export async function removeUnits({
  taskId,
  packageId,
  orderLineId,
  quantity,
  lotNumber,
  serialNumber,
  scanId,
}: RemoveUnitsInput): Promise<PackingSession> {
  const { data } = await api.delete<unknown>(
    `${packagePath({ taskId, packageId })}/lines/${encodeURIComponent(orderLineId)}`,
    { params: { quantity, lotNumber, serialNumber, scanId } },
  );
  return parseSession(data);
}

/** Cân, đo, niêm phong (docs 08 bước 5–7). Thiếu số đo → 400; kiện rỗng → 409 `PACKAGE_EMPTY`. */
export async function sealPackage({
  taskId,
  packageId,
  values,
}: SealPackageInput): Promise<PackPackage> {
  const { data } = await api.post<unknown>(`${packagePath({ taskId, packageId })}/seal`, values);
  return bePackageSchema.parse(data);
}

/** Mở lại kiện đã niêm phong khi chưa vào lô giao (409 `PACKAGE_SHIPPED` sau đó). */
export async function reopenPackage(ref: PackageRef): Promise<PackPackage> {
  const { data } = await api.post<unknown>(`${packagePath(ref)}/reopening`);
  return bePackageSchema.parse(data);
}

/** Huỷ kiện (VOIDED): hàng trong kiện tính là chưa đóng, nhãn vô hiệu. */
export async function voidPackage(ref: PackageRef): Promise<PackingSession> {
  const { data } = await api.delete<unknown>(packagePath(ref));
  return parseSession(data);
}

/** Dữ liệu nhãn kiện (`Cache-Control: no-store`); kiện chưa niêm phong → 409. FE tự dựng bố cục in. */
export async function getPackageLabel(
  ref: PackageRef,
  signal?: AbortSignal,
): Promise<PackageLabel> {
  const { data } = await api.get<unknown>(`${packagePath(ref)}/label`, { signal });
  return bePackageLabelSchema.parse(data);
}

/* ── Hoàn tất ────────────────────────────────────────────────────────── */

/**
 * Mọi kiện đã niêm phong và chưa giao thành MỘT lô giao READY_TO_DISPATCH (`shipmentId` trong câu
 * trả lời). `partial` + ghi chú: giao trước phần đã niêm phong, phần còn lại giao sau. Dòng in lệch
 * thiết kế vẫn HTTP 200 với pack `On Hold` và KHÔNG có `shipmentId` — người gọi phải đọc `packStatus`.
 */
export async function completePacking({
  taskId,
  requestId,
  partial,
  note,
}: CompletePackingInput): Promise<FulfillmentTask> {
  const { data } = await api.post<unknown>(`${taskPath(taskId)}/packing-completion`, {
    requestId,
    partial,
    note: partial ? note : undefined,
  });
  return toFulfillmentTask(beFulfillmentTaskSchema.parse(data));
}
