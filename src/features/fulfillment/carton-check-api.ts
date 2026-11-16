/**
 * Trạm kiểm thùng & dán nhãn giao hàng — API layer, khớp BE `CartonCheckController` + `POST /tasks/{id}/packing-completion`
 * (4C-6, docs 08). Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 *
 * Quét LPN, dán nhãn, in lại, loại thùng đều gửi lại được mà không ghi hai lần (BE trả 200, không đổi gì); in lại gửi
 * `fromVersion`, hoàn tất gửi `requestId`. Parse zod một lần tại biên.
 */

import { CARTON_STATUS, PACK_API_STATUSES, PACK_STATUS_BY_API, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { toFulfillmentTask } from "./api";
import { beCartonCheckQueuePageSchema, beCartonCheckSessionSchema } from "./carton-check-schemas";
import { beFulfillmentTaskSchema } from "./schemas";

import type { CartonApiStatus, PackApiStatus } from "@/constants";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  Carton,
  CartonCheckQueueParams,
  CartonCheckQueueRow,
  CartonCheckSession,
  CartonCheckSessionDto,
  CartonRemovalInput,
  CartonReprintInput,
  CartonScanInput,
  CartonSelectionInput,
  CompleteCartonCheckInput,
  SessionStatus,
  ShippingLabelsPdf,
} from "./carton-check-types";
import type { FulfillmentTask } from "./types";

const FULFILLMENT_PATH = "/fulfillment";
const QUEUE_PATH = `${FULFILLMENT_PATH}/packing-queue`;
const DEFAULT_LABELS_FILE = "shipping-labels.pdf";
const FILE_NAME = /filename="?([^";]+)"?/i;

const taskPath = (taskId: string) => `${FULFILLMENT_PATH}/tasks/${encodeURIComponent(taskId)}`;
const cartonPath = (taskId: string, lpn: string) =>
  `${taskPath(taskId)}/cartons/${encodeURIComponent(lpn)}`;

/** `PackStatus` BE → tên hiển thị; giá trị lạ (schema đã đổi thành UNKNOWN) → "Unknown". */
export function displaySessionStatus(status: string): SessionStatus {
  const known = PACK_API_STATUSES.find(
    (candidate): candidate is PackApiStatus => candidate === status,
  );
  return known ? PACK_STATUS_BY_API[known] : "Unknown";
}

function displayCartonStatus(status: string): Carton["status"] {
  const known = (Object.keys(CARTON_STATUS) as CartonApiStatus[]).find(
    (candidate) => candidate === status,
  );
  return known ? CARTON_STATUS[known] : "Unknown";
}

export function toCartonCheckSession(dto: CartonCheckSessionDto): CartonCheckSession {
  return {
    ...dto,
    status: displaySessionStatus(dto.status),
    cartons: dto.cartons.map((carton) => ({
      ...carton,
      status: displayCartonStatus(carton.status),
    })),
  };
}

const parseSession = (data: unknown): CartonCheckSession =>
  toCartonCheckSession(beCartonCheckSessionSchema.parse(data));

/* ── Hàng chờ ────────────────────────────────────────────────────────── */

/**
 * Đơn đã lấy hàng xong, thùng ở khu xuất hàng, cũ nhất trước (docs 08 §4.1 bước 1); chỉ các kho người gọi được xem.
 * Bỏ trống `status` = đang chờ (PENDING, IN_PROGRESS); trạng thái lạ → 400 `UNSUPPORTED_PARAMETER`.
 */
export async function listCartonCheckQueue(
  params: CartonCheckQueueParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CartonCheckQueueRow>> {
  const { data } = await api.get<unknown>(QUEUE_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      warehouseId: params.warehouseId || undefined,
      status: params.status || undefined,
    },
    signal,
  });
  const page = beCartonCheckQueuePageSchema.parse(data);
  return {
    ...page,
    items: page.items.map((row) => ({ ...row, status: displaySessionStatus(row.status) })),
  };
}

/* ── Phiên kiểm thùng ────────────────────────────────────────────────── */

/** Đọc phiên — đọc được cả trước khi bắt đầu (thùng chưa nhận hiện `To Check`, chưa có `packageId`). */
export async function getCartonCheckSession(
  taskId: string,
  signal?: AbortSignal,
): Promise<CartonCheckSession> {
  const { data } = await api.get<unknown>(`${taskPath(taskId)}/packing-session`, { signal });
  return parseSession(data);
}

/**
 * Nhân viên kho bắt đầu kiểm thùng (docs 08 §4.1 bước 2): PENDING → IN_PROGRESS, ghi người bắt đầu. Gọi lại bởi chính
 * người đó thì trả nguyên phiên; người khác → 409 `PACKING_TAKEN` (quản lý kho không bị chặn); 409 `PACKING_NOT_READY`
 * khi thùng chưa về khu xuất hàng (task còn STAGED).
 */
export async function startCartonCheck(taskId: string): Promise<CartonCheckSession> {
  const { data } = await api.post<unknown>(`${taskPath(taskId)}/packing-start`);
  return parseSession(data);
}

/**
 * Một LPN được quét (docs 08 §4.2 bước 3): thùng To Check → Checked; quét lại thùng đã kiểm → 200, không đổi gì;
 * LPN không thuộc task → 409 `CARTON_NOT_IN_TASK`.
 */
export async function checkCarton({ taskId, lpn }: CartonScanInput): Promise<CartonCheckSession> {
  const { data } = await api.post<unknown>(`${taskPath(taskId)}/carton-checks`, { lpn });
  return parseSession(data);
}

/**
 * Dán nhãn các thùng được chọn, hoặc mọi thùng Checked khi không chọn (docs 08 §4.3 bước 5–6): thùng lấy kích thước,
 * khối lượng từ quy cách thùng của SKU và thành Labeled; nhãn đầu tiên khoá đơn (BR-04). 422 `CARTON_SPEC_UNMEASURED`
 * nêu các SKU thiếu quy cách (BR-07, cả loạt không dán được); 409 `CARTON_NOT_CHECKED`. Gửi lại → 200, không đổi gì.
 * Sau đó in nhãn bằng `printShippingLabels`.
 */
export async function labelCartons({
  taskId,
  lpns,
}: CartonSelectionInput): Promise<CartonCheckSession> {
  const { data } = await api.post<unknown>(
    `${taskPath(taskId)}/carton-labels`,
    lpns && lpns.length > 0 ? { lpns: [...lpns] } : undefined,
  );
  return parseSession(data);
}

/**
 * Nhãn rách / mất in lại (docs 08 BR-08): phiên bản nhãn +1, nhãn cũ vô hiệu. Chỉ người bắt đầu phiên hoặc quản lý kho,
 * kể cả khi phiên đã Completed. `fromVersion` = phiên bản đang dán: gửi lại sau khi thùng đã qua phiên bản đó → 200,
 * không đổi gì.
 */
export async function reprintCartonLabel({
  taskId,
  lpn,
  fromVersion,
}: CartonReprintInput): Promise<CartonCheckSession> {
  const { data } = await api.post<unknown>(`${cartonPath(taskId, lpn)}/label-reprint`, undefined, {
    params: { fromVersion },
  });
  return parseSession(data);
}

/**
 * Loại thùng hư hỏng khỏi đơn (docs 08 §4.2 bước 4): Removed, vào hàng chờ cất lại để cất nguyên thùng vào khu
 * QUARANTINE. Gửi lại → 200; thùng đã vào shipment → 409 `PACKAGE_SHIPPED`.
 */
export async function removeCarton({
  taskId,
  lpn,
  note,
}: CartonRemovalInput): Promise<CartonCheckSession> {
  const { data } = await api.post<unknown>(
    `${cartonPath(taskId, lpn)}/removal`,
    note ? { note } : undefined,
  );
  return parseSession(data);
}

/**
 * Nhãn giao hàng dạng PDF, mỗi thùng một trang 100 × 150 mm (docs 08 §4.3 bước 6): các thùng được chọn, hoặc mọi thùng
 * đã dán nhãn chưa vào shipment. Không đổi gì ở BE. Thành công trả PDF (Blob); lỗi vẫn là JSON envelope —
 * `lib/api/client` đọc body Blob ra trước khi map `ApiError` (409 `CARTON_NOT_CHECKED` cho thùng chưa dán nhãn).
 */
export async function printShippingLabels({
  taskId,
  lpns,
}: CartonSelectionInput): Promise<ShippingLabelsPdf> {
  const response = await api.post<Blob>(
    `${taskPath(taskId)}/shipping-labels`,
    lpns && lpns.length > 0 ? { lpns: [...lpns] } : undefined,
    { responseType: "blob", headers: { Accept: "application/pdf, application/json" } },
  );
  const disposition: unknown = response.headers["content-disposition"];
  const fileName = typeof disposition === "string" ? FILE_NAME.exec(disposition)?.[1] : undefined;
  return { blob: response.data, fileName: fileName ?? DEFAULT_LABELS_FILE };
}

/* ── Hoàn tất ────────────────────────────────────────────────────────── */

/**
 * Các thùng đã dán nhãn chưa vào shipment thành MỘT shipment READY_TO_DISPATCH (`shipmentId` trong câu trả lời). Thứ tự
 * kiểm của BE (docs 08 §4.4 bước 8): mọi thùng Labeled hoặc Removed (409 `PACKING_INCOMPLETE`), có ít nhất một thùng
 * Labeled (409 `PACK_NOTHING_TO_SHIP`), thiếu thùng thì phải `partial` + `note` và đơn phải được Sale cho phép (409
 * `PACK_PARTIAL_NOT_ALLOWED`). Còn đợt BEFORE_DELIVERY chưa thu → vẫn HTTP 200, kèm `paymentDue` (cảnh báo, bước 9).
 */
export async function completeCartonCheck({
  taskId,
  requestId,
  partial,
  note,
}: CompleteCartonCheckInput): Promise<FulfillmentTask> {
  const { data } = await api.post<unknown>(`${taskPath(taskId)}/packing-completion`, {
    requestId,
    partial,
    note: partial ? note : undefined,
  });
  return toFulfillmentTask(beFulfillmentTaskSchema.parse(data));
}
