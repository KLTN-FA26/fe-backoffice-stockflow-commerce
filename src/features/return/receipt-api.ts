/**
 * Phiếu nhập hàng hoàn — API layer (BE `ReturnReceiptController`, `/goods-receipts/returns`; docs 03 §4.2, BR-14).
 * Hàng về nhận theo LPN thẳng vào khu cách ly; xác nhận phiếu đưa yêu cầu trả hàng sang RECEIVED.
 */

import { z } from "zod";

import { api } from "@/lib/api/client";
import { uploadSlotSchema } from "@/lib/api/direct-upload";

import {
  returnedShipmentPageDtoSchema,
  returnReceiptDtoSchema,
  returnReceiptPageDtoSchema,
} from "./schemas";

import type { ReturnReceiptApiStatus } from "@/constants/returns";
import type { UploadDeclaration, UploadSlot } from "@/lib/api/direct-upload";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { ReturnedShipment, ReturnReceipt, ReturnReceiptRow } from "./types";

const BASE = "/goods-receipts/returns";
const seg = encodeURIComponent;

export interface ListReturnReceiptParams extends ListQueryParams {
  statuses?: readonly ReturnReceiptApiStatus[];
  warehouseId?: string;
  orderId?: string;
  returnRequestId?: string;
  search?: string;
}

export async function listReturnReceipts(
  params: ListReturnReceiptParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReturnReceiptRow>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  for (const status of params.statuses ?? []) query.append("status", status);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.returnRequestId) query.set("returnRequestId", params.returnRequestId);
  if (params.search?.trim()) query.set("search", params.search.trim());
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return returnReceiptPageDtoSchema.parse(data);
}

export async function getReturnReceipt(id: string, signal?: AbortSignal): Promise<ReturnReceipt> {
  const { data } = await api.get<unknown>(`${BASE}/${seg(id)}`, { signal });
  return returnReceiptDtoSchema.parse(data);
}

const parse = (data: unknown): ReturnReceipt => returnReceiptDtoSchema.parse(data);

/** Đúng một nguồn: `returnRequestId` (yêu cầu AWAITING_RETURN) hoặc `shipmentId` (chuyến RETURNED). */
export async function createReturnReceipt(input: {
  returnRequestId?: string;
  shipmentId?: string;
  quarantineLocationCode: string;
  note?: string;
}): Promise<ReturnReceipt> {
  const { data } = await api.post<unknown>(BASE, {
    ...(input.returnRequestId ? { returnRequestId: input.returnRequestId } : {}),
    ...(input.shipmentId ? { shipmentId: input.shipmentId } : {}),
    quarantineLocationCode: input.quarantineLocationCode,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  });
  return parse(data);
}

/**
 * Quét lại cùng LPN = cùng thùng; `condition` gửi kèm thay ghi chú cũ. `countedQuantity` (WF-05 TH-4): số thực có trong
 * thùng đã mở, 0..số trên nhãn (vượt → `VALIDATION_FAILED`); không gửi = thùng nguyên. BE tự đánh `opened` khi ít hơn nhãn.
 */
export async function scanReturnCarton(input: {
  id: string;
  lpn: string;
  condition?: string;
  countedQuantity?: number;
}): Promise<ReturnReceipt> {
  const { data } = await api.post<unknown>(`${BASE}/${seg(input.id)}/cartons`, {
    lpn: input.lpn,
    ...(input.condition?.trim() ? { condition: input.condition.trim() } : {}),
    ...(input.countedQuantity !== undefined ? { countedQuantity: input.countedQuantity } : {}),
  });
  return parse(data);
}

/**
 * Bước 1 của ảnh hàng lẻ tải thẳng lên kho (WF-05 Q-18): xin đường PUT ở endpoint ảnh nhận hàng sẵn có của phiếu nhập
 * (`POST /goods-receipts/{receiptId}/photos/uploads`, `procurement-goods-receipts:UPDATE` — người đếm là kho, không có
 * quyền ảnh của yêu cầu trả hàng).
 */
export async function beginLoosePhotoUpload(
  receiptId: string,
  declaration: UploadDeclaration,
  signal?: AbortSignal,
): Promise<UploadSlot> {
  const { data } = await api.post<unknown>(
    `/goods-receipts/${seg(receiptId)}/photos/uploads`,
    declaration,
    { signal },
  );
  return uploadSlotSchema.parse(data);
}

const receiptPhotoSchema = z.object({ id: z.string() });

/**
 * Bước 3: giữ ảnh đã PUT thành một ảnh nhận hàng của phiếu (BE `POST /goods-receipts/{receiptId}/photos` `{uploadId}`;
 * gửi lại cùng `uploadId` = cùng ảnh). Trả `id` của ảnh — `photoId` của dòng hàng lẻ (BE G4 `RecordLooseUnitsRequest`).
 */
export async function attachLoosePhoto(receiptId: string, uploadId: string): Promise<string> {
  const { data } = await api.post<unknown>(`/goods-receipts/${seg(receiptId)}/photos`, {
    uploadId,
  });
  return receiptPhotoSchema.parse(data).id;
}

/**
 * Hàng lẻ không nhãn thùng (WF-05 TH-4; BE `POST /{id}/loose-lines`): chỉ phiếu nháp của một yêu cầu trả hàng. Cùng SKU
 * và lô thì thay số cũ. SKU không thuộc đơn → `VALIDATION_FAILED`. WF-05 Q-18 (BE-43): ảnh bắt buộc
 * (`RETURN_LOOSE_PHOTO_REQUIRED`) — `photoId` là một ảnh nhận hàng của chính phiếu (`attachLoosePhoto`); tổng đã về của
 * SKU, mọi phiếu cộng lại, không vượt số đã duyệt (`RETURN_LOOSE_EXCEEDS_APPROVED`).
 */
export async function recordLooseLine(input: {
  id: string;
  sku: string;
  lotNumber?: string;
  quantity: number;
  photoId: string;
}): Promise<ReturnReceipt> {
  const { data } = await api.post<unknown>(`${BASE}/${seg(input.id)}/loose-lines`, {
    sku: input.sku.trim(),
    ...(input.lotNumber?.trim() ? { lotNumber: input.lotNumber.trim() } : {}),
    quantity: input.quantity,
    photoId: input.photoId,
  });
  return parse(data);
}

export async function removeLooseLine(input: { id: string; lineId: string }) {
  const { data } = await api.delete<unknown>(
    `${BASE}/${seg(input.id)}/loose-lines/${seg(input.lineId)}`,
  );
  return parse(data);
}

export async function removeReturnCarton(input: { id: string; lpn: string }) {
  const { data } = await api.delete<unknown>(`${BASE}/${seg(input.id)}/cartons/${seg(input.lpn)}`);
  return parse(data);
}

export async function confirmReturnReceipt(input: { id: string }) {
  const { data } = await api.post<unknown>(`${BASE}/${seg(input.id)}/confirmation`);
  return parse(data);
}

export async function cancelReturnReceipt(input: { id: string }) {
  const { data } = await api.post<unknown>(`${BASE}/${seg(input.id)}/cancellation`);
  return parse(data);
}

/** Chuyến hãng đã hoàn về kho (nguồn của phiếu RTO) — `fulfillment-shipments:READ`. */
export async function listReturnedShipments(
  size: number,
  signal?: AbortSignal,
): Promise<ReturnedShipment[]> {
  const { data } = await api.get<unknown>("/fulfillment/shipments", {
    params: { status: "RETURNED", page: 0, size },
    signal,
  });
  return returnedShipmentPageDtoSchema.parse(data).items;
}
