/**
 * Mock lịch giao của đơn (BE `DeliveryBatchService`, docs 17 §4.5, §5.5, BR-28) — logic THUẦN + store in-memory, không
 * đăng ký route (route: `mock-routes-order-schedule.ts`).
 *
 * ASSUMPTION (mock-only): mock-data không có hợp đồng nên lịch giao được suy từ đơn — đơn ≥ 2 dòng có HAI đợt (nửa
 * đầu các dòng ở đợt 1, phần còn lại ở đợt 2), đơn 1 dòng có một đợt; cửa sổ hợp đồng = ngày đặt + 14 / 28 ngày (3 ngày
 * mỗi cửa sổ); mọi thùng coi như đã giữ đủ (`heldCartons = cartons`). Trạng thái hiển thị tính từ trạng thái đơn và các lô
 * giao như BE `stateOf`: không ai gán tay.
 */

import { toLocalIsoDate } from "@/lib/format/date";

import type { MockShipment } from "./mock-routes-orders-store";
import type { Order } from "@/lib/mock-data";

export type MockBatchState = "AWAITING_STOCK" | "READY" | "IN_DELIVERY" | "DELIVERED" | "CLOSED";

export interface MockBatch {
  batchId: string;
  seq: number;
  contractWindowStart: string;
  contractWindowEnd: string;
  lineIds: string[];
}

/** Một lần dời cửa sổ (BE `ordering.delivery_batch_window_change`). */
export interface MockWindowChange {
  id: string;
  batchId: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  reason: string;
  note: string;
  /** Đúng một trong hai (BR-28): tin nhắn chat của khách hoặc tên tệp đã tải lên. */
  evidenceMessageId: string | null;
  evidenceFileName: string | null;
  changedBy: string;
  changedAt: string;
}

/** Id đợt giao mock: ổn định theo đơn. Đợt 1 = `mockBatchIdOf(order)` (release mặc định). */
export const mockBatchIdAt = (orderId: string, seq: number) => `BATCH-${orderId}-${seq}`;
export const mockBatchIdOf = (order: Pick<Order, "orderId">) => mockBatchIdAt(order.orderId, 1);

/**
 * Tin nhắn chat mock KHÔNG phải của khách (nhân viên / hệ thống gửi): BE `consentMessages` từ chối làm bằng chứng
 * (400 VALIDATION_FAILED). Mọi UUID hợp lệ khác coi là tin nhắn khách gửi trong chat của khách (mock-only).
 */
export const MOCK_STAFF_MESSAGE_ID = "00000000-0000-4000-8000-0000000000aa";

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  toLocalIsoDate(new Date(new Date(iso).getTime() + days * DAY_MS).toISOString());

export function batchesOf(order: Order): MockBatch[] {
  const base = toLocalIsoDate(order.placedAt);
  const lineIds = order.lines.map((line) => line.lineId);
  const groups =
    lineIds.length >= 2 ? [lineIds.slice(0, Math.ceil(lineIds.length / 2))] : [lineIds];
  if (lineIds.length >= 2) groups.push(lineIds.slice(groups[0]?.length ?? 0));
  return groups.map((ids, index) => ({
    batchId: mockBatchIdAt(order.orderId, index + 1),
    seq: index + 1,
    contractWindowStart: addDays(base, 14 * (index + 1)),
    contractWindowEnd: addDays(base, 14 * (index + 1) + 3),
    lineIds: ids,
  }));
}

/** Tệp bằng chứng đã xin đường tải (BE `StagedUploads` session); `received` = đã PUT lên "kho". */
export interface MockEvidenceUpload {
  orderId: string;
  batchId: string;
  fileName: string;
  sizeBytes: number;
  received: boolean;
  attached: boolean;
}

const uploads = new Map<string, MockEvidenceUpload>();
export const evidenceUploadById = (uploadId: string) => uploads.get(uploadId);
export function saveEvidenceUpload(uploadId: string, upload: MockEvidenceUpload): void {
  uploads.set(uploadId, upload);
}

/** Loại tệp `FileCategory.DOCUMENT` của BE và trần 25 MB. */
export const MOCK_DOCUMENT_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];
export const MOCK_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const changes = new Map<string, MockWindowChange[]>();

export const windowChangesOf = (orderId: string): readonly MockWindowChange[] =>
  changes.get(orderId) ?? [];

export function recordWindowChange(orderId: string, change: MockWindowChange): void {
  changes.set(orderId, [...windowChangesOf(orderId), change]);
}

/** Xoá mọi lần dời cửa sổ của phiên — test gọi giữa các ca (cùng `resetOrderMockStore`). */
export function resetDeliveryScheduleMockStore(): void {
  changes.clear();
  uploads.clear();
}

/** Cửa sổ HIỆU LỰC của một đợt: lần dời mới nhất, hoặc cửa sổ hợp đồng khi chưa dời. */
export function windowInForce(orderId: string, batch: MockBatch): { start: string; end: string } {
  const latest = windowChangesOf(orderId)
    .filter((change) => change.batchId === batch.batchId)
    .at(-1);
  return latest
    ? { start: latest.newStart, end: latest.newEnd }
    : { start: batch.contractWindowStart, end: batch.contractWindowEnd };
}

/** Số đơn vị của đợt đã nằm trong lô giao (`deliveredOnly`: chỉ lô đã giao thành công; lô hoàn không tính). */
function shippedUnits(
  batch: MockBatch,
  shipments: readonly MockShipment[],
  deliveredOnly: boolean,
) {
  return shipments
    .filter((s) => (deliveredOnly ? s.status === "DELIVERED" : s.status !== "RETURNED"))
    .flatMap((s) => s.lines)
    .filter((line) => batch.lineIds.includes(line.lineId))
    .reduce((sum, line) => sum + line.quantity, 0);
}

/** Đợt có lô giao nào (kể cả lô đã hoàn) — BE `DELIVERY_BATCH_WINDOW_LOCKED`. */
export const batchHasShipment = (batch: MockBatch, shipments: readonly MockShipment[]) =>
  shipments.some((s) => s.lines.some((line) => batch.lineIds.includes(line.lineId)));

/** BE `DeliveryBatchService#stateOf` (docs 17 §5.5). */
export function batchStateOf(
  order: Order,
  batch: MockBatch,
  shipments: readonly MockShipment[],
  orderClosed: boolean,
): MockBatchState {
  const units = order.lines
    .filter((line) => batch.lineIds.includes(line.lineId))
    .reduce((sum, line) => sum + line.quantity, 0);
  if (units > 0 && shippedUnits(batch, shipments, true) >= units) return "DELIVERED";
  if (orderClosed) return "CLOSED";
  if (shippedUnits(batch, shipments, false) > 0) return "IN_DELIVERY";
  return "READY";
}
