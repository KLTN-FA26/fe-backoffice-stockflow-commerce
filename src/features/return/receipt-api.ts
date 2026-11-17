/**
 * Phiếu nhập hàng hoàn — API layer (BE `ReturnReceiptController`, `/goods-receipts/returns`; docs 03 §4.2, BR-14).
 * Hàng về nhận theo LPN thẳng vào khu cách ly; xác nhận phiếu đưa yêu cầu trả hàng sang RECEIVED.
 */

import { api } from "@/lib/api/client";

import {
  returnedShipmentPageDtoSchema,
  returnReceiptDtoSchema,
  returnReceiptPageDtoSchema,
} from "./schemas";

import type { ReturnReceiptApiStatus } from "@/constants/returns";
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

/** Quét lại cùng LPN = cùng thùng; `condition` gửi kèm thay ghi chú cũ. */
export async function scanReturnCarton(input: {
  id: string;
  lpn: string;
  condition?: string;
}): Promise<ReturnReceipt> {
  const { data } = await api.post<unknown>(`${BASE}/${seg(input.id)}/cartons`, {
    lpn: input.lpn,
    ...(input.condition?.trim() ? { condition: input.condition.trim() } : {}),
  });
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
