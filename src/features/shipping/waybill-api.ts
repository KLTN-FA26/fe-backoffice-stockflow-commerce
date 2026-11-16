/**
 * Shipping — API mã vận đơn theo chuyến (BE `LoadWaybillController`, `WaybillImportController`; docs 09 §4.4).
 *
 *   PUT  /fulfillment/loads/{id}/waybill {waybillNo, vehiclePlate?, driverName?, driverPhone?, reason?}
 *        `fulfillment-dispatch:UPDATE`; sau khi chuyến rời kho là SỬA mã: thêm `fulfillment-waybill-corrections:UPDATE`
 *        + bắt buộc `reason` (BR-24). 409 INVALID_LOAD_TRANSITION (chưa đặt xe / đã huỷ), WAYBILL_DUPLICATE (BR-23),
 *        WAYBILL_FROM_CARRIER_API (hãng đặt xe qua API không nhập tay).
 *   GET  /fulfillment/loads/{id}/waybill-history        → mọi lần đổi mã, cũ nhất trước (`fulfillment-shipments:READ`)
 *   GET  /fulfillment/waybill-imports/template          → file CSV mẫu (UTF-8 có BOM) — `fulfillment-waybill-imports:READ`
 *   POST /fulfillment/waybill-imports/preview           multipart `file` → kiểm từng dòng, chưa ghi gì — `…:CREATE`
 *   POST /fulfillment/waybill-imports?overwriteLines=…  multipart `file` → áp các dòng hợp lệ; dòng GHI ĐÈ mã cũ chỉ áp
 *        khi số dòng nằm trong `overwriteLines` (BR-25) — `…:CREATE`. 400 WAYBILL_IMPORT_INVALID_FILE.
 * File vận đơn đính kèm chuyến (BR-28, tuỳ chọn) chưa có màn hình.
 */

import { api } from "@/lib/api/client";

import { loadPath } from "./api";
import { beLoadSchema } from "./load-schemas";
import { beWaybillHistorySchema, beWaybillImportSchema } from "./waybill-schemas";

import type {
  Load,
  RecordWaybillInput,
  WaybillChange,
  WaybillImport,
  WaybillImportFileInput,
} from "./types";

export const WAYBILL_IMPORTS_PATH = "/fulfillment/waybill-imports";

/** Nhập tay mã vận đơn (hoặc sửa sau khi rời kho — kèm lý do). Trả chuyến mới nhất. */
export async function recordWaybill({ loadId, values }: RecordWaybillInput): Promise<Load> {
  const { data } = await api.put<unknown>(`${loadPath(loadId)}/waybill`, values);
  return beLoadSchema.parse(data);
}

export async function getWaybillHistory(
  loadId: string,
  signal?: AbortSignal,
): Promise<WaybillChange[]> {
  const { data } = await api.get<unknown>(`${loadPath(loadId)}/waybill-history`, { signal });
  return beWaybillHistorySchema.parse(data);
}

/** File mẫu nhập mã vận đơn (CSV UTF-8 có BOM — Excel đọc đúng tiêu đề tiếng Việt). */
export async function downloadWaybillTemplate(): Promise<Blob> {
  const { data } = await api.get<Blob>(`${WAYBILL_IMPORTS_PATH}/template`, {
    responseType: "blob",
  });
  return data;
}

/** Như `uploadVariantMedia`: ghi đè `application/json` mặc định của axios client để trình duyệt đặt boundary. */
const MULTIPART = { "Content-Type": "multipart/form-data" } as const;

function formOf(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

/** Xem trước: kiểm từng dòng của file với các chuyến nó nêu, KHÔNG ghi gì. */
export async function previewWaybillImport(file: File): Promise<WaybillImport> {
  const { data } = await api.post<unknown>(`${WAYBILL_IMPORTS_PATH}/preview`, formOf(file), {
    headers: MULTIPART,
  });
  return beWaybillImportSchema.parse(data);
}

/**
 * Nhập file: các dòng hợp lệ được áp dụng, dòng lỗi giữ lại kèm lý do, file được lưu làm file vận đơn của các chuyến
 * đã đổi. `overwriteLines` = số dòng người dùng đã xác nhận ghi đè (BR-25).
 */
export async function importWaybillFile({
  file,
  overwriteLines,
}: WaybillImportFileInput): Promise<WaybillImport> {
  const { data } = await api.post<unknown>(WAYBILL_IMPORTS_PATH, formOf(file), {
    headers: MULTIPART,
    params: overwriteLines.length > 0 ? { overwriteLines: overwriteLines.join(",") } : undefined,
  });
  return beWaybillImportSchema.parse(data);
}
